// Paths that must never be named in a committed map.
//
// COMPLEX.md is committed and read by every agent. A hotspot row naming
// .env.production or deploy/id_rsa tells a reader where the credentials are
// and tells an agent to open them. The file itself is never read here, only
// its path, so this is a name check: a path whose name has the shape of a
// credential file is dropped from every list and counted under blind_spots.
//
// The practice comes from repomix (yamadashy/repomix, MIT), which runs
// Secretlint over file contents before packing a repository for a model.
// This is the path level version of the same idea; the patterns are this
// project's own and deliberately conservative, since a false positive here
// removes one row and a false negative points at a secret.

const SECRET_PATH = [
  /(^|\/)\.env(\.(?!example$|sample$|template$|dist$)[^/]*)?$/i, // .env, .env.local; not .env.example
  /(^|\/)\.envrc$/i,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /(^|\/)(secrets?|credentials?)\.(json|ya?ml|toml|env)$/i,
  /(^|\/)\.(npmrc|pypirc|netrc)$/i,
  /(^|\/)\.aws\/credentials$/i,
  /(^|\/)\.docker\/config\.json$/i,
  /(^|\/)(service[-_]?account|gcp[-_]?key|firebase[-_]?adminsdk)[^/]*\.json$/i,
  /(^|\/)\.git-credentials$/i,
  /(^|\/)\.htpasswd$/i,
];

/** True when the path's name has the shape of a credential file. */
export function isSecretPath(path) {
  return SECRET_PATH.some((re) => re.test(path));
}

/** Partition paths into the safe list and the dropped list. */
export function dropSecretPaths(paths) {
  const kept = [], dropped = [];
  for (const p of paths) (isSecretPath(p) ? dropped : kept).push(p);
  return { kept, dropped };
}
