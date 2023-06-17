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
  