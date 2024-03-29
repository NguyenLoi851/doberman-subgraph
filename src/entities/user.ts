import {Address} from "@graphprotocol/graph-ts"
import {User} from "../../generated/schema"

export function getOrInitUser(address: Address): User {
  let user = User.load(address.toHexString())
  if (!user) {
    user = new User(address.toHexString())
    user.uidType = null
    user.isGoListed = false
    user.poolTokens = []
    user.save()
  }
  return user
}
