import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { More } from "iconsax-react";
import Skeleton from "@mui/material/Skeleton";
import Template from "./Template";
import Spacer from "./Spacer";
export default function Card2({ icon: Icon, color = "white", label, value }) {
  return (
    <Card2Wrapper
      color={color}
      sx={{
        border: "1px solid rgba(0,0,0,0.05)",
        maxHeight: "10rem",
      }}
    >
      <div className="flex flex-col p-4 pl-6  pb-2">
        <Box
          sx={{
            backgroundColor: "primary.dark",
            p: 1,
            borderRadius: "50%",
            width: 24,
            mb: 1,
          }}
        >
          <Icon size={16} color="white" className="block" />
        </Box>
        <Spacer />
        <Typography variant="body2">
          {label ?? <Skeleton width={200} />}
        </Typography>
        <Spacer />
        <Typography variant="h4" as="h3" sx={{ my: 1 }}>
          {value ?? <Skeleton width="100%" />}
        </Typography>
      </div>
      <IconButton>
        <More />
      </IconButton>
    </Card2Wrapper>
  );
}

export function Card2Wrapper({ color = "transparent", ...props }) {
  return (
    <Template
      props={props}
      as={Paper}
      className="items-center flex justify-between mx-2 basis-48 flex-grow"
      elevation={2}
      sx={{
        backgroundColor: color,
        minWidth: "12rem",
        maxWidth: "24rem",
        my: 2,
      }}
    />
  );
}
