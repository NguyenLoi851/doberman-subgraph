import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Protocol } from "../../generated/schema"

function getOrInitProtocol(): Protocol {
    let protocol = Protocol.load("1")
    if (!protocol) {
        protocol = new Protocol("1")
        protocol.loans = []
        protocol.totalWritedowns = BigInt.zero()
        protocol.totalDrawdowns = BigInt.zero()
        protocol.defaultRate = BigDecimal.zero()
        protocol.totalPrincipalCollected = BigInt.zero()
        protocol.totalInterestCollected = BigInt.zero()
        protocol.totalReserveCollected = BigInt.zero()
        protocol.numLoans = 0
    }
    return protocol
}

export function addToListOfAllLoans(loanAddress: Address): void {
    const protocol = getOrInitProtocol()
    protocol.loans = protocol.loans.concat([loanAddress.toHexString()])
    protocol.numLoans = protocol.loans.length
    protocol.save()
}