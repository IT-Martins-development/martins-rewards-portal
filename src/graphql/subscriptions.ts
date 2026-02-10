/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateReward = /* GraphQL */ `subscription OnCreateReward($filter: ModelSubscriptionRewardFilterInput) {
  onCreateReward(filter: $filter) {
    id
    title
    description
    pointsCost
    isActive
    imageUrl
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateRewardSubscriptionVariables,
  APITypes.OnCreateRewardSubscription
>;
export const onUpdateReward = /* GraphQL */ `subscription OnUpdateReward($filter: ModelSubscriptionRewardFilterInput) {
  onUpdateReward(filter: $filter) {
    id
    title
    description
    pointsCost
    isActive
    imageUrl
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateRewardSubscriptionVariables,
  APITypes.OnUpdateRewardSubscription
>;
export const onDeleteReward = /* GraphQL */ `subscription OnDeleteReward($filter: ModelSubscriptionRewardFilterInput) {
  onDeleteReward(filter: $filter) {
    id
    title
    description
    pointsCost
    isActive
    imageUrl
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteRewardSubscriptionVariables,
  APITypes.OnDeleteRewardSubscription
>;
export const onCreateRewardRedemption = /* GraphQL */ `subscription OnCreateRewardRedemption(
  $filter: ModelSubscriptionRewardRedemptionFilterInput
  $userId: String
) {
  onCreateRewardRedemption(filter: $filter, userId: $userId) {
    id
    userId
    rewardId
    pointsSpent
    status
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateRewardRedemptionSubscriptionVariables,
  APITypes.OnCreateRewardRedemptionSubscription
>;
export const onUpdateRewardRedemption = /* GraphQL */ `subscription OnUpdateRewardRedemption(
  $filter: ModelSubscriptionRewardRedemptionFilterInput
  $userId: String
) {
  onUpdateRewardRedemption(filter: $filter, userId: $userId) {
    id
    userId
    rewardId
    pointsSpent
    status
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateRewardRedemptionSubscriptionVariables,
  APITypes.OnUpdateRewardRedemptionSubscription
>;
export const onDeleteRewardRedemption = /* GraphQL */ `subscription OnDeleteRewardRedemption(
  $filter: ModelSubscriptionRewardRedemptionFilterInput
  $userId: String
) {
  onDeleteRewardRedemption(filter: $filter, userId: $userId) {
    id
    userId
    rewardId
    pointsSpent
    status
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteRewardRedemptionSubscriptionVariables,
  APITypes.OnDeleteRewardRedemptionSubscription
>;
export const onCreateUserRewardBalance = /* GraphQL */ `subscription OnCreateUserRewardBalance(
  $filter: ModelSubscriptionUserRewardBalanceFilterInput
) {
  onCreateUserRewardBalance(filter: $filter) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateUserRewardBalanceSubscriptionVariables,
  APITypes.OnCreateUserRewardBalanceSubscription
>;
export const onUpdateUserRewardBalance = /* GraphQL */ `subscription OnUpdateUserRewardBalance(
  $filter: ModelSubscriptionUserRewardBalanceFilterInput
) {
  onUpdateUserRewardBalance(filter: $filter) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateUserRewardBalanceSubscriptionVariables,
  APITypes.OnUpdateUserRewardBalanceSubscription
>;
export const onDeleteUserRewardBalance = /* GraphQL */ `subscription OnDeleteUserRewardBalance(
  $filter: ModelSubscriptionUserRewardBalanceFilterInput
) {
  onDeleteUserRewardBalance(filter: $filter) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteUserRewardBalanceSubscriptionVariables,
  APITypes.OnDeleteUserRewardBalanceSubscription
>;
