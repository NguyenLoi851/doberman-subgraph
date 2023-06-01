import {
  BorrowerCreated
} from "../../generated/DobermanFactory/DobermanFactory"
import { getOrInitBorrower } from "../entities/borrower"


export function handleBorrowerCreated(event: BorrowerCreated): void {
  getOrInitBorrower(event.params.borrower, event.params.owner, event.block.timestamp)
}

