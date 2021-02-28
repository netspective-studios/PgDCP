CREATE EXTENSION IF NOT EXISTS plpython3u;

-- TODO: perform pip install or upgrade of required packages via an anonymous code block
-- DO $$
-- import pip3
-- pip3.main(["install", "--user", "pillow"])
-- $$ LANGUAGE plpython3u;

DO $$
BEGIN
    CREATE TYPE image_format_size_type AS (
        format  TEXT, --icon format
        icon_size  INTEGER[]--icon size as (height,width)
       -- is_valid BOOLEAN, -- true if valid image content else false - TODO
	   -- status_msg TEXT-- errors if any if the image content is not valid -TODO
    );
EXCEPTION
    WHEN DUPLICATE_OBJECT THEN
        RAISE NOTICE 'type "image_format_size_type" already exists, skipping';
END
$$;

--TODO - Exception Handling to return status(error if image content is invalid) and isvalid boolean
CREATE OR REPLACE FUNCTION image_format_size(image bytea)  RETURNS image_format_size_type AS $$
from io import BytesIO
import PIL
from PIL import Image

basewidth = 300
mem_file = BytesIO()
mem_file.write(image)
img = Image.open(mem_file)
img.verify()
format=img.format
icon_size=img.size
img.close()
return format,icon_size 
$$ LANGUAGE plpython3u;
comment on function image_format_size(image bytea) is 'Given a binary image, detect its format and size';

CREATE OR REPLACE FUNCTION :dcp_schema_assurance.test_image_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    -- TODO: figure how to test whether required pip modules (e.g. pillow) are installed
    RETURN NEXT has_function('image_format_size');
    RETURN NEXT has_type('image_format_size_type');
END;
$$;
