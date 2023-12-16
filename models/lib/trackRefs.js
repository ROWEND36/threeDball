import { InvalidParameters, UnimplementedError } from "@/models/lib/errors";
import { None } from "@/utils/none";
import notIn from "@/utils/notIn";
import UpdateValue, { isUpdateValue } from "./update_value";
import { getItemFromStore } from "./item_store";
import { getDefaultValue } from "./model_type_info";

const refProps = Symbol("refProps");

function toArray(e) {
  return Array.isArray(e) ? e : e ? [e] : [];
}

//Tracks updates to prevent nested updates
const updateSink = [];
const withUpdate = async (item, prop, cb) => {
  const x = { m: item.model(), id: item.id(), prop };
  if (
    updateSink.some(
      (e) =>
        e.m === x.m &&
        e.id === x.id &&
        (!e.prop || !x.prop || e.prop === x.prop)
    )
  )
    return;
  try {
    // console.log("Updating ", item.uniqueName() + "." + prop);
    updateSink.push(x);
    return await cb();
  } finally {
    // console.log("Updated ", item.uniqueName() + "." + prop);
    updateSink.splice(updateSink.indexOf(x), 1);
  }
};
/**
 *
 * @typedef {import("@/models/lib/model").Item} Item
 * @param {Item} item
 * @param {import("./lib/transaction").default} txn
 * @param {*} newState
 */
export async function onRefsUpdateItem(item, txn, newState, isUpdate = true) {
  if (!item[refProps]) return;
  const { props, AddActions, RemoveActions } = item[refProps];
  await Promise.all(
    props.map((e) => {
      if (isUpdate && !item.didUpdate(e)) return;
      return withUpdate(item, e, async () => {
        // Currently, UpdateValues are only used when there are no side effects
        if (isUpdateValue(newState[e])) return;
        const newValue = toArray(newState[e]);
        const oldValue = item.isLocalOnly()
          ? []
          : toArray((await item.read(txn))?.[e]);
        const added = newValue.filter(notIn(oldValue));
        const removed = oldValue.filter(notIn(newValue));
        await Promise.all(
          removed.map(async (id) => {
            const meta = item.model().Meta[e];
            const refModel =
              meta.type === "array" ? meta.arrayType.refModel : meta.refModel;
            const refItem = refModel.item(id);
            await Promise.all(
              RemoveActions[e].map(async (action) =>
                withUpdate(refItem, action.prop, () =>
                  action.run(txn, item, refItem)
                )
              )
            );
          })
        );
        await Promise.all(
          added.map(async (id) => {
            const meta = item.model().Meta[e];
            const refModel =
              meta.type === "array" ? meta.arrayType.refModel : meta.refModel;
            const created = getItemFromStore(refModel.ref(id));
            if (created !== null && created.isLocalOnly()) {
              await created.save(txn);
            }
            const refItem = created ?? refModel.item(id);
            await Promise.all(
              AddActions[e].map(async (action) =>
                withUpdate(refItem, action.prop, () =>
                  action.run(txn, item, refItem)
                )
              )
            );
          })
        );
      });
    })
  );
}
export async function onRefsAddItem(item, txn, newState) {
  return onRefsUpdateItem(item, txn, newState, false);
}

export async function onRefsDeleteItem(item, txn) {
  return onRefsUpdateItem(item, txn, None, false);
}

/**
 * One requirement of actions is that they must be idempotent.
 * Otherwise, using them with UpdateValues would fail
 */
class Action {
  constructor(prop) {
    this.prop = prop;
  }
  // eslint-disable-next-line no-unused-vars
  async run(txn, item, refItem) {
    throw UnimplementedError("Action.run is not implemented");
  }
}

export class AppendIDAction extends Action {
  /**
   *
   * @param {import("./lib/transaction").default} txn
   * @param {Item} item
   * @param {Item} refItem
   */
  async run(txn, item, refItem) {
    // console.log(
    //   "appending " + item.id() + " to " + refItem.uniqueName() + "." + this.prop
    // );
    await refItem.set({ [this.prop]: UpdateValue.arrayUnion(item.id()) }, txn);
  }
}

export class SetIDAction extends Action {
  /**
   *
   * @param {import("./lib/transaction").default} txn
   * @param {Item} item
   * @param {Item} refItem
   */
  async run(txn, item, refItem) {
    // console.log(
    //   "setting value " +
    //     item.id() +
    //     " for " +
    //     refItem.uniqueName() +
    //     "." +
    //     this.prop
    // );
    await refItem.set({ [this.prop]: item.id() }, txn);
  }
}

export class RemoveIDAction extends Action {
  /**
   *
   * @param {import("./lib/transaction").default} txn
   * @param {Item} item
   * @param {Item} refItem
   */
  async run(txn, item, refItem) {
    // console.log(
    //   "removing value " +
    //     item.id() +
    //     " from items in " +
    //     refItem.uniqueName() +
    //     "." +
    //     this.prop
    // );
    await refItem.set({ [this.prop]: UpdateValue.arrayRemove(item.id()) }, txn);
  }
}

export class UnsetIDAction extends Action {
  /**
   *
   * @param {import("./lib/transaction").default} txn
   * @param {Item} item
   * @param {Item} refItem
   */
  async run(txn, item, refItem) {
    // console.log(
    //   "clearing value " +
    //     item.id() +
    //     " for " +
    //     refItem.uniqueName() +
    //     "." +
    //     this.prop
    // );
    await refItem.set(
      { [this.prop]: getDefaultValue(refItem.model().Meta[this.prop]) },
      txn
    );
  }
}

export class DeleteItemAction extends Action {
  /**
   *
   * @param {import("./lib/transaction").default} txn
   * @param {Item} item
   * @param {Item} refItem
   */
  async run(txn, item, refItem) {
    // console.log("deleting " + refItem.id());
    await refItem.delete(txn);
  }
}
/**
 *
 * @param {typeof import("./counted_item").CountedItem} ItemClass
 * @param {Array<String>} props
 * @param {Array<Action>} addActions
 * @param {Array<Action>} removeActions
 */
export function trackRefs(ItemClass, props, addActions, removeActions) {
  const prev = ItemClass.prototype[refProps];
  const newRefProps = {
    props: prev ? prev.props.concat(props) : props,
    AddActions: Object.assign(
      {},
      prev ? prev.AddActions : null,
      ...props.map((e) => ({
        [e]: prev?.AddActions?.[e]
          ? prev.AddActions[e].concat(addActions)
          : addActions ?? [],
      }))
    ),
    RemoveActions: Object.assign(
      {},
      prev ? prev.RemoveActions : null,
      ...props.map((e) => ({
        [e]: prev?.RemoveActions?.[e]
          ? prev.RemoveActions[e].concat(removeActions)
          : removeActions ?? [],
      }))
    ),
  };
  ItemClass.markTriggersUpdateTxn(props, true);
  ItemClass.prototype[refProps] = newRefProps;
}

/**
 * @typedef {import("./model").Item} Item
 */
/**
 * Actions are used to implement associations
 * @template {Item} K
 * @template {Item} L
 * @param {import("./model").Model<K>} modelA
 * @param {keyof K} fieldA
 * @param {import("./model").Model<L>} modelB
 * @param {keyof L} fieldB
 * @param {boolean} deleteOnRemove
 */
export function hasOneOrMore(
  modelA,
  fieldA,
  modelB,
  fieldB,
  deleteOnRemove,
  noRecurse
) {
  const isTwoWay = !!fieldB;
  if (!modelA.Meta[fieldA])
    throw new Error("No usch field " + fieldA + " in " + modelA.uniqueName());
  const isArray1 = modelA.Meta[fieldA].type === "array";
  if (isTwoWay && !modelB.Meta[fieldB])
    throw new Error("No usch field " + fieldB + " in " + modelB.uniqueName());
  const isArray2 = isTwoWay && modelB.Meta[fieldB].type === "array";
  if (isArray2 && deleteOnRemove)
    throw new InvalidParameters("Cannot use deleteOnRemove with array target");

  trackRefs(
    modelA._Item,
    [fieldA],
    [
      isArray2
        ? new AppendIDAction(fieldB)
        : isTwoWay
        ? new SetIDAction(fieldB)
        : null,
    ].filter(Boolean),
    [
      deleteOnRemove
        ? new DeleteItemAction()
        : isTwoWay
        ? new UnsetIDAction(fieldB)
        : null,
    ].filter(Boolean)
  );

  if (isArray1) modelA.Meta[fieldA].arrayType.refModel = modelB;
  else modelA.Meta[fieldA].refModel = modelB;
  if (!noRecurse && isTwoWay) {
    hasOneOrMore(modelB, fieldB, modelA, fieldA, false, true);
  }
}
