CREATE EXTENSION IF NOT EXISTS plpython3u;

-- TODO: perform pip install or upgrade of required packages via an anonymous code block
-- DO $$
-- import pip3
-- pip3.main(["install", "--user", "pillow"])
-- $$ LANGUAGE plpython3u;

CREATE OR REPLACE FUNCTION image_format_size(image bytea) RETURNS table(format text, size integer[]) AS $$
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

CREATE OR REPLACE FUNCTION :schema_assurance.test_image_management() RETURNS SETOF TEXT LANGUAGE plpgsql AS $$
BEGIN 
    RETURN NEXT has_extension('plpython3u');
    -- TODO: figure how to test whether required pip modules (e.g. pillow) are installed
    RETURN NEXT has_function('image_format_size');
END;
$$;
