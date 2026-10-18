"use strict";
// Preserve configured Linux toolchains without changing host configuration.
const LINUX_BUILD_PATH_SCRIPT = `material_path=
material_old_ifs=$IFS
IFS=:
set -f
for material_entry in $PATH; do
 case "$material_entry" in
  /*) case "$material_entry" in *[[:space:]]*|/mnt/[a-z]/*) ;; *) material_path="\${material_path:+$material_path:}$material_entry" ;; esac ;;
 esac
done
set +f
IFS=$material_old_ifs
PATH="\${material_path:+$material_path:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
unset material_path material_old_ifs material_entry
`;
module.exports = { LINUX_BUILD_PATH_SCRIPT };
