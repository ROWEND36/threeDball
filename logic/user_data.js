import Students from "@/models/student";
import Teachers from "@/models/teacher";
import Parents from "@/models/parent";
import Admins from "@/models/admin";
import { onUser } from "./auth";
import { UserData, UserRoles } from "@/models/user_data";
import { noop } from "@/utils/none";
import { minutesToMs } from "@/utils/time_utils";
import { checkError } from "@/models/lib/errors";
import { FirebaseError } from "firebase/app";
import createSubscription from "@/utils/createSubscription";

const lookupRole = async (uid) => (await UserRoles.getOrCreate(uid, noop)).role;

export const updateUserRole = async (uid, role) => {
  await UserRoles.item(uid).set({ role });
};
/**
 *
 * @param {string} role
 * @returns {import("../models/lib/model").Model<import("../models/user_data").UserData>} model
 */
export const mapRoleToUserModel = (role) => {
  switch (role) {
    case "student":
      return Students;
    case "teacher":
      return Teachers;
    case "parent":
      return Parents;
    case "admin":
      return Admins;
  }
};
/**
 *
 * @param {import("firebase/auth").User} user
 * @returns {import("../models/user_data").UserData}
 */
const loadUserData = async (user) => {
  const role = await lookupRole(user.uid);
  if (role !== "guest") {
    console.log({ role });
    return (
      (await mapRoleToUserModel(role).getOrCreate(
        user.uid,
        async (item, txn) => {
          if (item.isLocalOnly()) {
            item.email = user.email;
            item.emailVerified = user.emailVerified;
            item.phoneNumber = user.phoneNumber;
          }
          const lastLogin = new Date();
          if (
            item.isLocalOnly() ||
            Math.abs(lastLogin.getTime() - item.lastLogin.getTime()) >
              minutesToMs(1)
          )
            await item.set({ lastLogin }, txn);
        }
      )) ?? UserData.of(user)
    );
  }
  return UserData.of(user);
};

/**
 * @type {import("@/utils/createSubscription").Subscription<import("../models/user_data").UserData>}
 */
const [useUserData] = createSubscription((setUserData) => {
  let retryDelay = 1000;
  let m;
  return onUser(async function retry(user) {
    try {
      clearTimeout(m);
      if (user) {
        const userData = await loadUserData(user);
        retryDelay = 1000;
        setUserData(userData);
      } else setUserData(user);
    } catch (e) {
      checkError(e, FirebaseError);
      retryDelay = retryDelay + Math.min(retryDelay, 60000);
      console.error(e, `Retrying in ${retryDelay / 1000} seconds`);
      m = setTimeout(() => retry(user), Math.min(retryDelay, 60000));
      window.addEventListener("online", function m() {
        console.log("Back Online");
        window.removeEventListener("online", m);
        retry(user);
      });
    }
  });
});
export default useUserData;
