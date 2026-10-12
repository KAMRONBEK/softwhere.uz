# gen2.sh <var> <kind> <tol> <lo> <hi> <ext> <indent> <prefix>...
var=$1; kind=$2; tol=$3; lo=$4; hi=$5; ext=$6; ind=$7; shift 7
for l in uz ru en; do for s in A B C D; do
  files=""; for p in "$@"; do [ -f "${p}_${l}_$s.txt" ] && files="$files ${p}_${l}_$s.txt"; done
  out=$(node fit2.js $kind $tol 12 $lo $hi $ext $files)
  echo "$var $l $s $(echo "$out" | head -1 | sed 's/"file":"[^"]*",//')" >&2
  printf "%s[data-lab-root][data-style='%s']:lang(%s) {\n%s  %s: %s;\n%s}\n\n" "$ind" $s $l "$ind" $var "$(echo "$out" | tail -1)" "$ind"
done; done
