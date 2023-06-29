import { Address, ethereum, BigInt } from "@graphprotocol/graph-ts"
import { DobermanConfig } from "../generated/DobermanConfig/DobermanConfig"
import { CONFIG_KEYS_ADDRESSES } from "./constants"

class ConfigBearer extends ethereum.SmartContract {
  config: () => Address
}

export function getAddressFromConfig<T extends ConfigBearer>(contract: T, target: CONFIG_KEYS_ADDRESSES): Address {
  const goldfinchConfigContract = DobermanConfig.bind(contract.config())
  return goldfinchConfigContract.getAddress(BigInt.fromI32(target))
}

/**
* Takes an array and an item to be removed from the array. Returns a copy of the array with the desired item removed. If the desired item is not present in the original array, then this returns a copy of that array.
* @param list
* @param itemToRemove
*/
export function removeFromList<T>(list: T[], itemToRemove: T): T[] {
  const listCopy = list.slice(0)
  const index = list.indexOf(itemToRemove)
  if (index >= 0) {
    listCopy.splice(index, 1)
  }
  return listCopy
}
