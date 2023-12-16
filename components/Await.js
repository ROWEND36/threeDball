import usePromise from "@/utils/usePromise";
import { Skeleton, Typography } from "@mui/material";

export default function Await({
  value,
  children,
  variant,
  chars = 2,
  ...props
}) {
  const resolved = usePromise(async () => (await value) ?? null, [value]);
  if (!children) {
    return (
      <Typography variant={variant} {...props}>
        {resolved === undefined ? (
          <Skeleton variant="text" sx={{ minWidth: chars + "em" }} />
        ) : (
          resolved
        )}
      </Typography>
    );
  } else {
    return resolved === undefined ? (
      <Skeleton>
        <div style={{ display: "inline", visibility: "hidden" }}>
          {children}
        </div>
      </Skeleton>
    ) : (
      children
    );
  }
}
