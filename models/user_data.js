import { increment } from "firebase/firestore";
import { CountedItem } from "./lib/counted_item";
import { Item, Model, USES_EXACT_IDS } from "./lib/model";
import { HiddenField } from "./lib/model_types";
import { trackFiles } from "./lib/trackFiles";
import { MODEL_ITEM_PREVIEW } from "@/components/ModelItemPreview";
import { indexForSearch } from "./lib/indexForSearch";
//A clone of the firebase authentication model is stored in firestore
//in order to manage users with the uid as the key
//Creating users can make use of the client sdk
//But getting users uid and deleting users makes use of the firebase admin sdk
//We make use of a UserRole map because checking if a user exists costs 1 read.
//With the UserRole map, we can get it using 2 reads all the time.
//Rather than 1 to N reads for all the users
//However, the concept of a filtered collection is also there and might be explored in future.

const DEFAULT_ROLE = "guest";
class UserRole extends Item {
  role = DEFAULT_ROLE;
}
export const UserRoles = new Model("roles", UserRole, {
  [USES_EXACT_IDS]: true,
});

export class UserData extends CountedItem {
  firstName = "";
  lastName = "";
  otherNames = "";
  email = "";
  emailVerified = false;
  phoneNumber = "";
  dateCreated = new Date();
  lastUpdated = new Date();
  photoURL = "";
  lastLogin = new Date(0);
  profileCompleted = false;
  disabled = false;
  getName() {
    return `${this.firstName} ${this.otherNames} ${this.lastName}`;
  }
  upgradeUser(prevRole) {
    throw new Error(
      "Cannot upgrade user from " + prevRole + " to " + this.getRole()
    );
  }
  getRole() {
    return "guest";
  }
  /**
   *
   * @param {import("firebase/auth").User} user
   */
  static of(user) {
    const m = UserData.empty();
    m.setData(user);
    return m;
  }

  async _update(txn, newState, prevState) {
    return super._update(
      txn,
      Object.assign(newState, { lastUpdated: Date.now() }),
      prevState
    );
  }
  async onDeleteItem(txn, prevState) {
    await super.onDeleteItem(txn, prevState);
    if (prevState.profileCompleted)
      this.getCounter().set(
        {
          completedProfiles: increment(-1),
        },
        txn
      );
    await UserRoles.item(this.id()).delete(txn);
  }
  async onAddItem(txn, newState) {
    await super.onAddItem(txn, newState);
    await UserRoles.getOrCreate(
      this.id(),
      async (userRole, txn) => {
        if (userRole.isLocalOnly())
          await userRole.set({ role: this.getRole() }, txn);
        else if (userRole.role !== this.getRole()) {
          await this.upgradeUser(userRole.role);
        }
      },
      txn
    );
    if (newState.profileCompleted)
      this.getCounter().set(
        {
          completedProfiles: increment(1),
        },
        txn
      );
  }
  static {
    trackFiles(this, ["photoURL"]);
    this.markTriggersUpdateTxn(["profileCompleted"]);

    indexForSearch(this, [
      "firstName",
      "lastName",
      "otherNames",
      "email",
      "phoneNumber",
    ]);
  }
}
/**
 * @type {import("./lib/model_type_info").ModelTypeInfo}
 */
export const UserMeta = {
  [USES_EXACT_IDS]: true,
  dateCreated: HiddenField,
  phoneNumber: {
    stringType: "tel",
  },
  email: {
    stringType: "email",
    disabled: true,
  },
  lastUpdated: HiddenField,
  lastLogin: HiddenField,
  profileCompleted: HiddenField,
  emailVerified: HiddenField,
  otherNames: {
    required: false,
  },
  photoURL: {
    required: false,
    type: "image",
    label: "Profile picture",
  },
  [MODEL_ITEM_PREVIEW](item) {
    return {
      title: item.getName(),
      description: item.email,
      avatar: item.photoURL,
    };
  },
};
