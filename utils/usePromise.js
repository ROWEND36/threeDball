import { useMemo } from "react";
import { useState, useEffect, useRef } from "react";
/**
 * @template  T
 *
 * @param {() => Promise<T>} createPromise
 * @param {Array<any>} deps
 * @returns {T|undefined}
 */
export default function usePromise(createPromise, deps) {
  const [, setData] = useState({});
  const ref = useRef({});
  const cb = useMemo(
    function () {
      ref.current = undefined;
      return createPromise;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...deps]
  );
  useEffect(
    function () {
      let stale = false;
      const promise = cb();
      if (!promise) return;
      promise.then(
        function (data) {
          if (!stale) {
            if (data !== ref.current) {
              ref.current = data;
              setData({});
            }
          }
        },
        function (e) {
          console.error(e);
        }
      );
      return function () {
        stale = true;
      };
    },
    [cb]
  );
  return ref.current;
}
