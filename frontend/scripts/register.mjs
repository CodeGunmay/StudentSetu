// Checks StudentSetu behavior against expected application workflows.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./jsx-loader.mjs', pathToFileURL('./scripts/'));
