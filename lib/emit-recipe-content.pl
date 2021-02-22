#!/usr/bin/env -S perl -w
use strict;

my $isHeader = 1;
while(<>) {
    next if $. == 1;              # skip the shebang line
    next if $isHeader && /^\s*$/; # skip all blank lines until the first non-blank
    $isHeader = 0;
    print;
}
