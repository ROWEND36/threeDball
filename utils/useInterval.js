import { useEffect, useRef } from "react";
import useStable from "./useStable";

export default function useInterval(update, delay) {
  const skip = useRef(false);
  update = useStable(update);
  useEffect(() => {
    const k = setInterval(() => {
      if (!skip.current) update();
      else skip.current = false;
    }, delay);
    return () => clearInterval(k);
  }, [delay, update]);
  return () => (skip.current = true);
}
