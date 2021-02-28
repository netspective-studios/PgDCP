#!/usr/bin/env -S perl -w
#
# Script for use in #! "shebang" output of Just command runner recipes that need
# to emit plain text content (as generated SQL or other dynamically prepared 
# source code). Just will typically emit the #! "shebang" with the dynamic output
# and may include multiple blank lines at the top of the emitted output. 
#
# This script removes the first line of output (the #! "shebang" line) as well
# any blank lines before the start of the first line of content. After that, all
# content is emitted by passing it through to the M4 template processor. All M4
# builtin macro names will require the start with the prefix ‘m4_’. For example, 
# one should write ‘m4_define’ instead of ‘define’, and ‘m4___file__’ instead of 
# ‘__file__’. 
#
# TODO: Add ability to pass in argument that indicates artifact type (e.g. SQL 
#       vs. BASH vs. some other content). Artifact type argument will allow this
#       script to determine things like comment prefix (e.g. -- vs. #).
# TODO: Search for :STR, :"STR", :'STR' patterns and group them at the top of the
#       file to be able to summarize which files use psql variables
# TODO: Add ability to pass in arguments that can provide additional file header
#       content such as host run on, date/time generated, Just file called from,
#       etc. This will allow generated content to clearly indicate provenance.
#
use strict;

my $isHeader = 1;
my $pid = open(M4, "| m4 --prefix-builtins") or die "Couldn't fork m4 template processor: $!\n";
while(<>) {
    next if $. == 1;              # skip the shebang line
    next if $isHeader && /^\s*$/; # skip all blank lines until the first non-blank
    $isHeader = 0;
    print M4 $_;
}
close(M4) or die "Couldn't close m4 PID $pid: $!\n";