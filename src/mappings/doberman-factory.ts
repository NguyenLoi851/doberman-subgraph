import {
  BorrowerCreated,
  PoolCreated,
} from "../../generated/DobermanFactory/DobermanFactory"
import { getOrInitBorrower } from "../entities/borrower"
import { addToListOfAllLoans } from "../entities/protocol"
import { getOrInitTranchedPool } from "../entities/tranched_pool"
import { TranchedPool as TranchedPoolTemplate } from "../../generated/templates"

export function handleBorrowerCreated(event: BorrowerCreated): void {
  getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}

export function handlePoolCreated(event: PoolCreated): void {
  TranchedPoolTemplate.create(event.params.pool)
  getOrInitTranchedPool(event.params.pool, event.block.timestamp, event.transaction.hash)
  addToListOfAllLoans(event.params.pool)
}
