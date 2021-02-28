#!/usr/bin/env -S perl -w
#
# Allows any text output to be prefixed with #! ("shebang") and have its content
# passed, optionally, through the M4 text preprocessor. 
#
# This script removes the first line of output (the #! "shebang" line) as well
# any blank lines before the start of the first line of content. After that, all
# content is emitted by passing it through to the M4 template processor. All M4
# builtin macro names will require the start with the prefix ‘m4_’. For example, 
# one should write ‘m4_define’ instead of ‘define’, and ‘m4___file__’ instead of 
# ‘__file__’. 
#
# Usage:
#   #!/usr/bin/env -S interpolate-shebang-content.pl --pp-m4
#   #!/usr/bin/env -S interpolate-shebang-content.pl --pp-m4 m4-path=1.m4:2.m4
#   #!/usr/bin/env -S interpolate-shebang-content.pl --pp-m4 m4-no-prefix-builtins
#   #!/usr/bin/env -S interpolate-shebang-content.pl --keep-leading-newlines 
#
# TODO: Add ability to accept OpenTelemetry trace IDs, spans, and other signals.
# TODO: Add ability to pass in argument that indicates artifact type (e.g. SQL 
#       vs. BASH vs. some other content). Artifact type argument will allow this
#       script to determine things like comment prefix (e.g. -- vs. #).
# TODO: Search for :STR, :"STR", :'STR' patterns and group them at the top of the
#       file to be able to summarize which files use psql variables
# TODO: Add ability to pass in arguments that can provide additional file header
#       content such as host run on, date/time generated, parent/file called from,
#       etc. This will allow generated content to clearly indicate provenance.
#
use strict;
use Getopt::Long;

my $preprocessM4;
my $m4NoPrefixBuiltins;
my $m4IncludePath;
my $keepLeadingNewlines;
GetOptions("pp-m4"                 => \$preprocessM4,
           "m4-no-prefix-builtins" => \$m4NoPrefixBuiltins,
           "m4-path"               => \$m4IncludePath,
           "keep-leading-newlines" => \$keepLeadingNewlines)
    or die("Error in command line arguments\n");

my $isHeader = 1;
if($preprocessM4) {
    my $include = $m4IncludePath ? " --include='$m4IncludePath'" : '';
    my $prefixBI = $m4NoPrefixBuiltins ? '' : ' --prefix-builtins';
    my $m4Args = "m4$prefixBI$include";
    my $pid = open(M4, "| $m4Args") or die "Couldn't fork m4 template processor: $!\n";
    while(<>) {
        next if $. == 1;               # always skip the, first, shebang line
        next if ($isHeader && /^\s*$/) && 
                !$keepLeadingNewlines; # skip all blank lines until the first non-blank
        $isHeader = 0;
        print M4 $_;
    }
    close(M4) or die "Couldn't close m4 PID $pid ($m4Args): $!\n";
} else {
    while(<>) {
        next if $. == 1;               # always skip the, first, shebang line
        next if ($isHeader && /^\s*$/) && 
                !$keepLeadingNewlines; # skip all blank lines until the first non-blank
        $isHeader = 0;
        print;
    }
}
