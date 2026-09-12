import { ObjectId } from "mongodb";

export function asString(value) {
  if (value == null) return "";
  return String(value);
}

export function idVariants(id) {
  const variants = [id];
  if (typeof id === "string" && ObjectId.isValid(id)) {
    variants.push(new ObjectId(id));
  }
  if (id instanceof ObjectId) {
    variants.push(id.toHexString());
  }
  return variants;
}

export function matchGroupId(field, groupId) {
  return { $or: idVariants(groupId).map((value) => ({ [field]: value })) };
}

export function sameId(a, b) {
  return asString(a) === asString(b);
}
