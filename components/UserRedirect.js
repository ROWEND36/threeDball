import { useUser } from "@/logic/auth";
import { useRouter } from "next/router";
import isServerSide from "@/utils/is_server_side";
import FullscreenLoader from "./FullscreenLoader";
import useUserData from "@/logic/user_data";

const DASHBOARD_URL = {
  administrator: "/admin",
  student: "/student",
  parent: "/parent",
  teacher: "/teacher",
  guest: "/admin",
};

export default function UserRedirect({
  redirectOnUser,
  redirectOnNoUser,
  children,
}) {
  const userData = useUserData();

  console.log({ userData });
  const router = useRouter();
  if (userData === undefined) {
    return <FullscreenLoader />;
  } else if (userData === null) {
    if (redirectOnNoUser) {
      if (!isServerSide) router.replace("/login");
      return null;
    }
  } else if (redirectOnUser) {
    if (!isServerSide) router.replace(DASHBOARD_URL[userData.role ?? "guest"]);
    return null;
  }
  return children;
}
