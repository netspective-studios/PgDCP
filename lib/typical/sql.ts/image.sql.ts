import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("image");

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options ||
      {
        schema: schemas.lib,
        affinityGroup,
        extensions: [schemas.pgCatalog.plPythonExtn],
      },
  );
  const [sQR] = state.observableQR(state.schema);
  const { lcFunctions: fn } = state.affinityGroup;

  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    -- TODO: perform pip install or upgrade of required packages via an anonymous code block
    -- DO $$
    -- import pip3
    -- pip3.main(["install", "--user", "pillow"])
    -- $$ LANGUAGE plpython3u;

    CREATE OR REPLACE PROCEDURE safe_create_image_meta_data_type() AS $$
    BEGIN
        CREATE TYPE ${sQR("image_meta_data")} AS (
            provenance TEXT,
            image_format TEXT,
            image_width INTEGER,
            image_height INTEGER,
            image_size_bytes INTEGER,
            image_is_valid BOOLEAN,
            image_status_msg TEXT
        );
        CREATE TYPE ${sQR("image_content")} AS (
            provenance TEXT,
            image bytea,
            image_format TEXT,
            image_width INTEGER,
            image_height INTEGER,
            image_size_bytes INTEGER,
            mime_type TEXT,
            image_format_original TEXT,
            image_size_original INTEGER,
            image_width_original INTEGER,
            image_height_original INTEGER,
            image_file_extension_original TEXT,
            mime_type_original TEXT,
            image_hash TEXT, -- TODO: create proper domain
            is_transformed BOOLEAN,
            image_is_valid BOOLEAN,
            image_file_extension TEXT,
            image_status_msg TEXT
        );
    EXCEPTION
        WHEN DUPLICATE_OBJECT THEN
            RAISE NOTICE 'type "image_meta_data" already exists, skipping';
    END;
    $$ LANGUAGE PLPGSQL;

    -- TODO: separate constructIdempotent into constructStorage/constructIdempotent
    -- TODO: separate destroyIdempotent into destroyStorage/destroyIdempotent
    CREATE OR REPLACE PROCEDURE ${fn.constructIdempotent(state).qName}() AS $constructIdempotentFn$
    BEGIN
        CALL safe_create_image_meta_data_type();
        
        CREATE OR REPLACE FUNCTION ${sQR("inspect_image_meta_data")}(provenance text, image bytea) RETURNS ${sQR("image_meta_data")} AS $innerFn$
        from io import BytesIO
        import PIL
        from PIL import Image
        try:
            mem_file = BytesIO()
            mem_file.write(image)
            img = Image.open(mem_file)
            img.verify()
            format = img.format
            width, height = img.size
            sizeBytes = mem_file.getbuffer().nbytes
            img.close()
            return provenance, format, width, height, sizeBytes, True, repr(img)
        except Exception as error:
            return provenance, "unknown", -1, -1, -1, False, repr(error)
        $innerFn$ LANGUAGE plpython3u;
        comment on function ${sQR("inspect_image_meta_data")}(provenance text, image bytea) is 'Given a binary image, detect its format and size';
        
        CREATE OR REPLACE FUNCTION ${sQR("optimize_image")}(provenance text,original_image bytea, optimize_size integer) RETURNS ${sQR("image_content")} AS $optimizeImageFn$
        import io
        from io import BytesIO
        from io import StringIO
        import PIL
        from PIL import Image
        import math
        import imagehash
        try:
            optimized_image = original_image
            mem_file = BytesIO()
            mem_file.write(original_image)
            img = Image.open(mem_file)
            img.verify()
            image_format_original = img.format
            image_hash = imagehash.average_hash(Image.open(mem_file))
            mime_type_original = Image.MIME[image_format_original]
            image_file_extension_original = '.'+image_format_original.lower()
            image_width_original, image_height_original = img.size
            image_size_original = mem_file.getbuffer().nbytes
            allowed_images = ['PNG', 'JPEG', 'JPG', 'jpg','png','jpeg','ICO','ico']
            is_transformed = False
            if image_size_original > optimize_size and image_format_original in allowed_images:
                is_transformed = True
                rgb_im = Image.open(mem_file).convert("RGB")
                Qmin, Qmax = 25, 96
                Qacc = -1
                while Qmin <= Qmax:
                    m = math.floor((Qmin + Qmax) / 2)
                    buffer = io.BytesIO()
                    rgb_im.save(buffer, format="JPEG", quality=m)
                    s = buffer.getbuffer().nbytes
                    if s <= optimize_size:
                        Qacc = m
                        Qmin = m + 1
                    elif s > optimize_size:
                        Qmax = m - 1
                image_format = 'JPEG'
                image_file_extension = '.jpeg'
                mime_type = Image.MIME[image_format]
                image_width, image_height = rgb_im.size
                buffer = io.BytesIO()
                if Qacc > -1:
                    rgb_im.save(buffer, format="JPEG", quality=Qacc)
                else:
                    rgb_im.save(buffer, format="JPEG", quality=50)
                size_bytes = buffer.getbuffer().nbytes
                optimized_image = buffer.getvalue()
            else:
                size_bytes = image_size_original
                image_format = image_format_original
                image_file_extension = image_file_extension_original
                mime_type = mime_type_original
                image_width = image_width_original
                image_height = image_height_original
            img.close()
            return provenance,optimized_image,image_format,image_width,image_height,size_bytes,mime_type,image_format_original, image_size_original,image_width_original, image_height_original,image_file_extension_original,mime_type_original,image_hash,is_transformed,True,image_file_extension,repr(img)
        except Exception as error:
            return provenance,original_image,"unknown",-1,-1,-1,"unknown","unknown",-1,-1,-1,"unknown","unknown","unknown",False,False,"unknown",repr(error)
        $optimizeImageFn$ LANGUAGE plpython3u;
        comment on function ${sQR("optimize_image")}(provenance text,original_image bytea, optimize_size integer) is 'Given a  compressed binary image, detect its format and size';

    END;$constructIdempotentFn$ LANGUAGE PLPGSQL;

    CREATE OR REPLACE PROCEDURE ${fn.destroyIdempotent(state).qName}() AS $$
    BEGIN
        DROP FUNCTION IF EXISTS ${fn.unitTest(state).qName}();
        DROP FUNCTION IF EXISTS image_format_size(bytea);
        DROP TYPE IF EXISTS image_format_size_type;
    END;
    $$ LANGUAGE PLPGSQL;
`;
}
