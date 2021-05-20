import * as SQLa from "../../mod.ts";
import { schemas } from "../mod.ts";

export const affinityGroup = new schemas.TypicalAffinityGroup("media_type");

export function SQL(
  ctx: SQLa.DcpInterpolationContext,
  options?: SQLa.InterpolationContextStateOptions,
): SQLa.DcpInterpolationResult {
  const state = ctx.prepareState(
    ctx.prepareTsModuleExecution(import.meta.url),
    options || { schema: schemas.lib, affinityGroup },
  );
  const { lcFunctions: lcf } = state.affinityGroup;
  // deno-fmt-ignore
  return SQLa.SQL(ctx, state)`
    -- TODO: separate constructIdempotent into constructStorage/constructIdempotent
    -- TODO: separate destroyIdempotent into destroyStorage/destroyIdempotent
    CREATE OR REPLACE FUNCTION ${
    lcf.constructIdempotent(state).qName
  }_sql(schemaName text, tableName text) RETURNS text AS $$
    BEGIN
        return format($execBody$
            CREATE TABLE IF NOT EXISTS %1$s.%2$s(
                mime_type TEXT,
                file_extn TEXT,
                label TEXT,
                CONSTRAINT %2$s_unq_row UNIQUE(mime_type, file_extn, label)
            );

            CREATE OR REPLACE PROCEDURE ${lcf.populateSeedData(state).qName}() AS $genBody$
            BEGIN
                -- used https://konbert.com/convert/csv/to/postgres for converting orignal CSV
                INSERT INTO %1$s.%2$s VALUES
                ('*/*','unknown','Unknown'),
                ('application/acad','dwg','AutoCAD drawing files'),
                ('application/andrew-inset','ez','Andrew data stream'),
                ('application/base64','mm',''),
                ('application/clariscad','ccad','ClarisCAD files'),
                ('application/drafting','drw','MATRA Prelude drafting'),
                ('application/dxf','dxf','DXF (AutoCAD)'),
                ('application/filemaker','fm','Filemaker Pro'),
                ('application/futuresplash','spl','Macromedia Futuresplash'),
                ('application/gzip','gz','Archive gzip compressed'),
                ('application/hdf','hdf','NCSA HDF data format'),
                ('application/iges','iges','Image - IGES graphics format'),
                ('application/javascript','js','Javascript'),
                ('application/mac-binhex40','hqx','Mac binhex 4.0'),
                ('application/mac-compactpro','cpt','Mac Compactpro'),
                ('application/mathematica','nb','Mathematica Notebooks'),
                ('application/msword','doc','Microsoft Word'),
                ('application/octet-stream','bin','Uninterpreted binary'),
                ('application/oda','oda','ODA ODIF'),
                ('application/oxps','oxps','OpenXPS'),
                ('application/pdf','pdf','PDF'),
                ('application/pkcs10','p','PKCS #10 - Certification Request Standard'),
                ('application/postscript','ps','PostScript'),
                ('application/rtf','rtf','RTF - Rich Text Format'),
                ('application/sdp','sdp','Session Description Protocol'),
                ('application/sla','stl','Stereolithography'),
                ('application/smil+xml','smi','Synchronized Multimedia Integration Language'),
                ('application/solids','sol','Solids'),
                ('application/vda','vda','VDA-FS Surface data'),
                ('application/vnd.adobe.flash-movie','swf','Macromedia Shockwave'),
                ('application/vnd.biopax.rdf+xml','owl','BioPAX OWL'),
                ('application/vnd.fdf','fdf','Forms Data Format'),
                ('application/vnd.geogebra.file','ggb','GeoGebra'),
                ('application/vnd.koan','skp','SSOYE Koan Files'),
                ('application/vnd.lotus-wordpro','lwp','Lotus Wordpro'),
                ('application/vnd.microsoft.portable-executable','exe','Microsoft Portable Executable'),
                ('application/vnd.mif','mif','FrameMaker MIF format'),
                ('application/vnd.ms-access','mdb','Microsoft Access file'),
                ('application/vnd.ms-excel','xls','Microsoft Excel'),
                ('application/vnd.ms-excel.addin.macroenabled.12','xlam','Microsoft Office Excel Addin macro enabled'),
                ('application/vnd.ms-excel.sheet.binary.macroenabled.12','xlsb','Microsoft Office Excel Sheet binary macro enabled'),
                ('application/vnd.ms-excel.sheet.macroenabled.12','xlsm','Microsoft Office Excel macro enabled'),
                ('application/vnd.ms-excel.template.macroenabled.12','xltm','Microsoft Office Excel Template macro enabled'),
                ('application/vnd.ms-officetheme','thmx','Microsoft Office System Release Theme'),
                ('application/vnd.ms-powerpoint','ppt','Microsoft PowerPoint'),
                ('application/vnd.ms-powerpoint.addin.macroenabled.12','ppam','Microsoft Office PowerPoint Addin macro enabled'),
                ('application/vnd.ms-powerpoint.presentation.macroenabled.12','pptm','Microsoft Office PowerPoint Presentation macro enabled'),
                ('application/vnd.ms-powerpoint.slideshow.macroenabled.12','ppsm','Microsoft Office PowerPoint Slideshow macro enabled'),
                ('application/vnd.ms-powerpoint.template.macroenabled.12','potm','Microsoft Office PowerPoint Template macro enabled'),
                ('application/vnd.ms-project','mpp','Microsoft Project'),
                ('application/vnd.ms-word.document.macroenabled.12','docm','Microsoft Office Word macro enabled'),
                ('application/vnd.ms-word.template.macroenabled.12','dotm','Microsoft Office Word Template macro enabled'),
                ('application/vnd.ms-wpl','wpl','Microsoft Windows Media Player Playlist'),
                ('application/vnd.ms-xpsdocument','xps','Microsoft XML Paper Specification'),
                ('application/vnd.novadigm.edx','edx','Novadigm RADIA and EDM products'),
                ('application/vnd.novadigm.ext','ext','Novadigm RADIA and EDM products'),
                ('application/vnd.oasis.opendocument.chart','odc','OpenDocument Chart'),
                ('application/vnd.oasis.opendocument.database','odb','OpenDocument Database'),
                ('application/vnd.oasis.opendocument.formula','odf','OpenDocument Formula'),
                ('application/vnd.oasis.opendocument.graphics','odg','OpenDocument Drawing'),
                ('application/vnd.oasis.opendocument.graphics-template','otg','OpenDocument Drawing Template'),
                ('application/vnd.oasis.opendocument.image','odi','OpenDocument Image'),
                ('application/vnd.oasis.opendocument.presentation','odp','OpenDocument Presentation'),
                ('application/vnd.oasis.opendocument.presentation-template','otp','OpenDocument Presentation Template'),
                ('application/vnd.oasis.opendocument.spreadsheet','ods','OpenDocument Spreadsheet'),
                ('application/vnd.oasis.opendocument.spreadsheet-template','ots','OpenDocument Spreadsheet Template'),
                ('application/vnd.oasis.opendocument.text','odt','OpenDocument Text'),
                ('application/vnd.oasis.opendocument.text-master','odm','OpenDocument Master Document'),
                ('application/vnd.oasis.opendocument.text-template','ott','OpenDocument Text Template'),
                ('application/vnd.oasis.opendocument.text-web','oth','HTML Document Template'),
                ('application/vnd.openxmlformats-officedocument.presentationml.presentation','pptx','Microsoft Office PowerPoint Presentation'),
                ('application/vnd.openxmlformats-officedocument.presentationml.slideshow','ppsx','Microsoft Office PowerPoint Slideshow'),
                ('application/vnd.openxmlformats-officedocument.presentationml-template','potx','Microsoft Office PowerPoint Template'),
                ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx','Microsoft Office Excel'),
                ('application/vnd.openxmlformats-officedocument.spreadsheetml-template','xltx','Microsoft Office Excel Template'),
                ('application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx','Microsoft Office Word'),
                ('application/vnd.openxmlformats-officedocument.wordprocessingml-template','dotx','Microsoft Office Word Template'),
                ('application/vnd.smart.notebook','notebook','SMART Notebook'),
                ('application/vnd.sun.xml.calc','sxc','OpenOffice Spreadsheet'),
                ('application/vnd.sun.xml.calc.template','stc','OpenOffice Spreadsheet Template'),
                ('application/vnd.sun.xml.draw','sxd','OpenOffice Draw'),
                ('application/vnd.sun.xml.draw.template','std','OpenOffice Draw Template'),
                ('application/vnd.sun.xml.impress','sxi','OpenOffice Impress'),
                ('application/vnd.sun.xml.impress.template','sti','OpenOffice Impress Template'),
                ('application/vnd.sun.xml.math','sxm','OpenOffice Math'),
                ('application/vnd.sun.xml.writer','sxw','OpenOffice Writer'),
                ('application/vnd.sun.xml.writer.global','sxg','OpenOffice Writer Global'),
                ('application/vnd.sun.xml.writer.template','stw','OpenOffice Writer Template'),
                ('application/vnd.tcpdump.pcap','pcap','Tcpdump Packet Capture'),
                ('application/vnd.wap.wmlc','wmlc','WML XML in binary format'),
                ('application/vnd.wap.wmlscriptc','wmlsc','WMLScript bytecode'),
                ('application/vnd.wolfram.player','nbp','Mathematica Notebook Player'),
                ('application/vnd.xara','xar','CorelXARA'),
                ('application/wordperfect','wpd','WordPerfect'),
                ('application/wordperfect6.0','w60','WordPerfect 6.0'),
                ('application/wsdl+xml','wsdl','WSDL - Web Services Description Language'),
                ('application/x-arj-compressed','arj','Archive ARJ '),
                ('application/x-authorware-bin','aab','Macromedia Authorware'),
                ('application/x-authorware-map','aam','Macromedia Authorware'),
                ('application/x-authorware-seg','aas','Macromedia Authorware'),
                ('application/x-cdf','cdf','Channel Definition'),
                ('application/x-cdlink','vcd','VCD'),
                ('application/x-chess-pgn','pgn','Chess PGN file'),
                ('application/x-compress','z','Archive compres'),
                ('application/x-cpio','cpio','Archive CPIO'),
                ('application/x-csh','csh','C-shell script'),
                ('application/x-debian-package','deb','Archive Debian Package'),
                ('application/x-director','dxr','Macromedia Director'),
                ('application/x-dvi','dvi','TeX DVI file'),
                ('application/x-gtar','gtar','Archive GNU Tar'),
                ('application/x-httpd-cgi','cgi','CGI Script'),
                ('application/x-illustrator','ai','Adobe Illustrator'),
                ('application/x-installshield','wis','Installshield data'),
                ('application/x-java-jnlp-file','jnlp','Java Network Launching Protocol'),
                ('application/x-latex','latex','LaTeX source'),
                ('application/x-ms-wmd','wmd','Windows Media Services (wmd)'),
                ('application/x-ms-wmz','wmz','Windows Media Services (wmz)'),
                ('application/x-netcdf','cdf','Unidata netCDF'),
                ('application/x-ogg','ogg','Audio Ogg Vorbis'),
                ('application/x-pagemaker','p65','Adobe PageMaker'),
                ('application/x-photoshop','psd','Photoshop'),
                ('application/x-pilot','prc','Palm Pilot Data'),
                ('application/x-pn-realmedia','rp','Audio Real'),
                ('application/x-quattro-pro','wq1','Quattro Pro'),
                ('application/x-rar-compressed','rar','Archive RAR'),
                ('application/x-spss-outputfile','spo','SPPS data file'),
                ('application/x-spss-savefile','sav','SPPS data file'),
                ('application/x-sql','sql','SQL'),
                ('application/x-stuffit','sit','Archive Mac Stuffit compressed'),
                ('application/x-sv4cpio','sv4cpio','Archive SVR4 cpio'),
                ('application/x-sv4crc','sv4crc','Archive SVR4 crc'),
                ('application/x-tar','tar','Archive Tar'),
                ('application/x-tex','tex','Text - TeX source'),
                ('application/x-texinfo','texinfo','Text - Texinfo (emacs)'),
                ('application/x-troff','tr','Text - troff'),
                ('application/x-troff-man','man','Text - troff with MAN macros'),
                ('application/x-troff-me','me','Text - troff with ME macros'),
                ('application/x-troff-ms','ms','Text - troff with MS macros'),
                ('application/x-ustar','ustar','Archive POSIX Tar'),
                ('application/x-x509-ca-cert','cacert','X509 CA Cert'),
                ('application/x-xpinstall','xpi','XPInstall'),
                ('application/zip','zip','Archive Zip'),
                ('audio/basic','au','Basic audio (m-law PCM)'),
                ('audio/midi','midi','Audio Midi'),
                ('audio/mp3','mp3','Audio - MP3'),
                ('audio/mpeg','mpeg','Audio - MPEG'),
                ('audio/rmf','rmf','Audio Java Media Framework'),
                ('audio/voice','voc','Audio Voice'),
                ('audio/wav','wav','Audio - WAV'),
                ('audio/x-aiff','aif','Audio AIFF'),
                ('audio/x-SQLa','xm','Audio Mod'),
                ('audio/x-mpeg','mp3','Audio MPEG'),
                ('audio/x-mpeg2','mp2a','Audio MPEG-2'),
                ('audio/x-mpegurl','m3u','Audio mpeg url (m3u)'),
                ('audio/x-ms-wma','wma','Audio Windows Media Services (wma)'),
                ('audio/x-ms-wmv','wmv','Audio Windows Media Services (wmv)'),
                ('audio/x-pn-realaudio','ra','Audio Realaudio'),
                ('audio/x-pn-realaudio-plugin','rm','Audio Realaudio Plugin'),
                ('audio/x-wav','wav','Audio Microsoft WAVE'),
                ('chemical/x-pdb','pdb','Chemical Brookhaven PDB'),
                ('chemical/x-xyz','xyz','Chemical XMol XYZ'),
                ('drawing/x-dwf','dwf','WHIP Web Drawing file'),
                ('image/bmp','bmp','Image - BMP'),
                ('image/fif','fif','Image - Fractal Image Format'),
                ('image/gif','gif','Image - Gif'),
                ('image/heic','heic','Image - HEIC'),
                ('image/heic-sequence','heics','Image - HEIC sequence'),
                ('image/heif','heif','Image - HEIF'),
                ('image/heif-sequence','heifs','Image - HEIF sequence'),
                ('image/ief','ief','Image - Image Exchange Format'),
                ('image/jpeg','jpg','Image - Jpeg'),
                ('image/pjpeg','pjpeg','Image - Progressive JPEG'),
                ('image/png','png','Image - PNG'),
                ('image/svg+xml','svg','Image - SVG'),
                ('image/tiff','tif','Image - TIFF'),
                ('image/vnd.ms-modi','mdi','Microsoft Document Imaging Format'),
                ('image/vnd.wap.wbmp','wbmp','Image - WAP wireless bitmap'),
                ('image/x-cmu-raster','ras','Image - CMU Raster'),
                ('image/x-fits','fit','Image - Flexible Image Transport'),
                ('image/x-freehand','fh','Image - Macromedia Freehand'),
                ('image/x-icon','ico','Image - ICO'),
                ('image/x-photo-cd','pcd','Image - PhotoCD'),
                ('image/x-pict','pict','Image - Mac pict'),
                ('image/x-portable-anymap','pnm','Image - PNM'),
                ('image/x-portable-bitmap','pbm','Image - PBM'),
                ('image/x-portable-graymap','pgm','Image - PGM'),
                ('image/x-portable-pixmap','ppm','Image - Portable Pixmap'),
                ('image/x-rgb','rgb','Image - RGB'),
                ('image/x-xbitmap','xbm','Image - X bitmap'),
                ('image/x-xpixmap','xpm','Image - X pixmap'),
                ('image/x-xwindowdump','xwd','Image - X window dump (xwd)'),
                ('message/rfc822','mime','RFC822 Message'),
                ('model/mesh','mesh','Computational mesh'),
                ('model/vnd.mts','mts','Virtue MTS'),
                ('multipart/voice-message','vpm','VPIM voice message'),
                ('text/calendar','ics','iCalendar'),
                ('text/css','css','Text - CSS'),
                ('text/csv','csv','Text - Comma separated value'),
                ('text/enhanced','etxt','Enhanced text'),
                ('text/enriched','rtx','Text - Enriched Text'),
                ('text/fixed-width','ftxt','Fixed-width text'),
                ('text/html','html','Text - HTML'),
                ('text/markdown','mtxt','Markdown text'),
                ('text/plain','txt','Text - Plain text'),
                ('text/plain; format=flowed','text','Text - Plain text (flowed)'),
                ('text/sgml','sgml','Text - SGML Text'),
                ('text/tab-separated-values','tsv','Text - Tab separated values'),
                ('text/vcard','vcf','VCard'),
                ('text/vnd.wap.wml','wml','Text - WML'),
                ('text/vnd.wap.wmlscript','wmls','Text - WMLScript'),
                ('text/xml','xml','Text - XML Document'),
                ('text/x-setext','etx','Text - Structured enhanced text'),
                ('text/xsl','xsl','Text - XSL'),
                ('video/fli','fli','Video FLI'),
                ('video/mp4','mp4','Video MP4'),
                ('video/mpeg','mpg','Video MPEG'),
                ('video/mpeg2','mpv2','Video MPEG-2'),
                ('video/quicktime','mov','Video Quicktime'),
                ('video/vdo','vdo','Video VDOlive streaming'),
                ('video/vnd.vivo','vivo','Video Vivo'),
                ('video/x-flv','flv','Video FLASH'),
                ('video/x-ms-asf','asf','Video Microsoft ASF'),
                ('video/x-msvideo','avi','Video Microsoft AVI'),
                ('video/x-ms-wm','wm','Video Windows Media Services (wm)'),
                ('video/x-ms-wvx','wvx','Video Windows Media Services (wvx)'),
                ('video/x-mx-wmx','wmx','Video Windows Media Services (wmx)'),
                ('video/x-sgi-movie','movie','Video SGI movie player'),
                ('x-conference/x-cooltalk','ice','Conference Cooltalk'),
                ('xuda/gen-cert','xuda','Xuda'),
                ('x-world/x-vrml','vrml','VRML') 
                ON CONFLICT(mime_type, file_extn, label) DO NOTHING; 
            END;
            $genBody$ LANGUAGE plpgsql;

            CREATE OR REPLACE PROCEDURE ${lcf.destroyIdempotent(state).qName}() AS $genBody$
            BEGIN
                DROP FUNCTION IF EXISTS ${lcf.unitTest(state, "%2$s").qName}();
                DROP TABLE IF EXISTS %1$s.%2$s;
            END;
            $genBody$ LANGUAGE plpgsql;

            CREATE OR REPLACE FUNCTION ${lcf.unitTest(state, "%2$s").qName}() RETURNS SETOF TEXT AS $genBody$
            BEGIN
                RETURN NEXT has_table('%1$s', '%2$s');
                RETURN NEXT ok(((select count(*) from %1$s.%2$s) > 0), 'Should have content in %1$s.%2$s');
            END;
            $genBody$ LANGUAGE plpgsql;
        $execBody$, schemaName, tableName);
    END;
    $$ LANGUAGE PLPGSQL;
    
    CREATE OR REPLACE PROCEDURE ${lcf.constructIdempotent(state).qName}(schemaName text, tableName text) AS $$
    BEGIN
        -- TODO: register execution in DCP Lifecyle log table
        EXECUTE(${
    lcf.constructIdempotent(state).qName
    }_sql(schemaName, tableName));
    END;
    $$ LANGUAGE PLPGSQL;`;
}
