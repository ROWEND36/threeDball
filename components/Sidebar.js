import AppLogo from "./AppLogo";
import Spacer from "./Spacer";
import Template from "./Template";
import { useRouter } from "next/router";
import { doLogOut } from "../logic/auth";
import { Setting, Logout } from "iconsax-react";
import {
  Box,
  Link,
  Typography,
  SwipeableDrawer,
  ButtonBase,
} from "@mui/material";
import createSubscription from "@/utils/createSubscription";
import { noop } from "@/utils/none";
import delay from "@/utils/delay";
import { useEffect } from "react";
import useQueryState from "@/utils/useQueryState";

export const [useSidebar, , setSidebar] = createSubscription(noop, false);

export function useActiveTab(tabs) {
  return useQueryState("tab", tabs[0]?.name?.toLowerCase?.())[0];
}

export default function Sidebar({ children, isStatic = false, tabs = [] }) {
  const selected = useActiveTab(tabs);
  const isOpen = useSidebar();
  useEffect(() => setSidebar(false), [selected]);
  return (
    <SwipeableDrawer
      onOpen={() => setSidebar(true)}
      onClose={() => setSidebar(false)}
      variant={isStatic ? "permanent" : "temporary"}
      open={isOpen}
      className="scroll-primary"
      sx={{
        "&>.MuiPaper-root": {
          backgroundColor: "primary.dark",
          position: isStatic ? "static" : "fixed",
        },
      }}
    >
      <nav className="text-white w-72 flex-shrink-0 pt-4 pb-8 flex flex-col justify-start h-full">
        <AppLogo className="block mx-auto relative right-2 pt-4 pb-8 h-20 mt-8 mb-4 w-auto px-4" />
        <div className="flex flex-col flex-grow overflow-auto pl-8 pr-6">
          {tabs.map(({ icon, name, id = name.toLowerCase() }) =>
            id === "settings" ? null : (
              <TabLink
                key={name}
                isSelected={id === selected}
                icon={icon}
                href={`?tab=${encodeURIComponent(id)}`}
              >
                {name}
              </TabLink>
            )
          )}
          <Spacer className="h-8 flex-shrink-0" />
          {tabs.map(({ icon, name, id = name.toLowerCase() }) =>
            id === "settings" ? (
              <TabLink
                key={name}
                isSelected={id === selected}
                icon={icon}
                href={`?tab=${encodeURIComponent(id)}`}
              >
                Settings
              </TabLink>
            ) : null
          )}
          <TabLink
            isActivated
            icon={Logout}
            as={ButtonBase}
            onClick={() => {
              doLogOut();
              setSidebar(false);
            }}
          >
            Log out
          </TabLink>
        </div>
      </nav>
      {children}
    </SwipeableDrawer>
  );
}

const TabLink = ({
  icon: Icon,
  children,
  isSelected,
  isActivated,
  ...props
}) => {
  return (
    <Template
      as={Link}
      props={props}
      className={`block text-left whitespace-nowrap w-full`}
      sx={{
        marginTop: "0.375rem",
        marginBottom: "0.375rem",
        py: 2,
        px: 4,
        textAlign: "left",
        display: "block",
        textDecoration: "none",
        borderRadius: "0.75rem",
        backgroundColor: isSelected ? "white" : "",
        color: isActivated
          ? "white"
          : isSelected
          ? "primary.dark"
          : "text.disabledOnPrimaryDark",
        "&:hover": {
          backgroundColor: isSelected ? "" : "primary.hover",
        },
      }}
    >
      <Typography>
        <Box
          as={Icon}
          size={24}
          sx={{
            color: isActivated
              ? "white"
              : isSelected
              ? "primary.main"
              : "text.disabledOnPrimaryDark",
          }}
          className="inline-block align-bottom mr-4"
        />
        {children}
      </Typography>
    </Template>
  );
};
