import { useMemo } from "react";

export default function useLogger(val_wrapper) {
  useMemo(() => {
    console.log(Object.keys(val_wrapper).map((e) => e + "=" + val_wrapper[e]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(val_wrapper));
}
