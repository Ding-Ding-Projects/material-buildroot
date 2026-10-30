# Sourced by the isolated Linux producer worker only. Match the execution service
# policy while also excluding a mounted drive root without a trailing slash.
material_path=
material_old_ifs=$IFS
IFS=:
set -f
for material_entry in $PATH; do
  case "$material_entry" in
    /*)
      case "$material_entry" in
        *[[:space:]]*|/mnt/[a-zA-Z]|/mnt/[a-zA-Z]/*) ;;
        *) material_path="${material_path:+$material_path:}$material_entry" ;;
      esac ;;
  esac
done
set +f
IFS=$material_old_ifs
PATH="${material_path:+$material_path:}/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PATH
unset material_path material_old_ifs material_entry
