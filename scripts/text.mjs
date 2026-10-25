// Text inputs of the site build. A Windows checkout with core.autocrlf=true
// has CRLF files, and the build splits and matches on \n, so each text file
// is read with LF. The site and the skill copies then come out the same on
// every checkout.
import { readFileSync } from 'node:fs';

export const readText = (path) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
