import { BigInt } from "@graphprotocol/graph-ts"
import {
    TokenMinted, TokenRedeemed, Transfer,
} from "../../generated/PoolTokens/PoolTokens"
import { PoolToken, TranchedPool } from "../../generated/schema"
import { getOrInitUser } from "../entities/user"
import { removeFromList } from "../utils"

export function handleTokenMinted(event: TokenMinted): void {
    const tranchedPool = TranchedPool.load(event.params.pool.toHexString())
    // const callableLoan = CallableLoan.load(event.params.pool.toHexString())
    const user = getOrInitUser(event.params.owner)
    if (tranchedPool) {
        const token = new PoolToken(event.params.tokenId.toString())
        token.mintedAt = event.block.timestamp
        token.user = user.id
        token.tranche = event.params.tranche
        token.principalAmount = event.params.amount
        token.principalRedeemed = BigInt.zero()
        token.interestRedeemed = BigInt.zero()
        token.interestRedeemable = BigInt.zero()
        token.rewardsClaimable = BigInt.zero()
        token.rewardsClaimed = BigInt.zero()
        token.stakingRewardsClaimable = BigInt.zero()
        token.stakingRewardsClaimed = BigInt.zero()
        token.isCapitalCalled = false
        token.loan = tranchedPool.id
        tranchedPool.tokens = tranchedPool.tokens.concat([token.id])
        tranchedPool.save()
        user.poolTokens = user.poolTokens.concat([token.id])
        user.save()
        token.save()
    }
}

export function handleTokenRedeemed(event: TokenRedeemed): void {
    const token = PoolToken.load(event.params.tokenId.toString())
    if (!token) {
        return
    }
    token.interestRedeemed = token.interestRedeemed.plus(event.params.interestRedeemed)
    token.principalRedeemed = token.principalRedeemed.plus(event.params.principalRedeemed)
    token.save()
}

export function handleTransfer(event: Transfer): void {
    const tokenId = event.params.tokenId.toString()
    const token = PoolToken.load(tokenId)
    if (!token) {
        return
    }
    const oldOwner = getOrInitUser(event.params.from)
    const newOwner = getOrInitUser(event.params.to)
    oldOwner.poolTokens = removeFromList(oldOwner.poolTokens, tokenId)
    oldOwner.save()
    newOwner.poolTokens = newOwner.poolTokens.concat([tokenId])
    newOwner.save()
    token.user = newOwner.id
    token.save()
}
