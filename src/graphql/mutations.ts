/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const _noop = /* GraphQL */ `mutation _noop {
  _noop
}
` as GeneratedMutation<APITypes._noopMutationVariables, APITypes._noopMutation>;
export const presignUpload = /* GraphQL */ `mutation PresignUpload($key: String!, $contentType: String) {
  presignUpload(key: $key, contentType: $contentType) {
    key
    uploadUrl
    expiresIn
    __typename
  }
}
` as GeneratedMutation<
  APITypes.PresignUploadMutationVariables,
  APITypes.PresignUploadMutation
>;
export const mongoRewardCreate = /* GraphQL */ `mutation MongoRewardCreate($input: MongoRewardInput!) {
  mongoRewardCreate(input: $input) {
    id
    code
    title {
      pt
      en
      es
      __typename
    }
    description {
      pt
      en
      es
      __typename
    }
    category
    tags
    pointsCost
    imageUrl
    deliveryType
    active
    offerStartAt
    offerEndAt
    createdAt
    updatedAt
    createdBy
    __typename
  }
}
` as GeneratedMutation<
  APITypes.MongoRewardCreateMutationVariables,
  APITypes.MongoRewardCreateMutation
>;
export const mongoRewardUpdate = /* GraphQL */ `mutation MongoRewardUpdate($input: MongoRewardUpdateInput!) {
  mongoRewardUpdate(input: $input) {
    id
    code
    title {
      pt
      en
      es
      __typename
    }
    description {
      pt
      en
      es
      __typename
    }
    category
    tags
    pointsCost
    imageUrl
    deliveryType
    active
    offerStartAt
    offerEndAt
    createdAt
    updatedAt
    createdBy
    __typename
  }
}
` as GeneratedMutation<
  APITypes.MongoRewardUpdateMutationVariables,
  APITypes.MongoRewardUpdateMutation
>;
export const mongoRewardDelete = /* GraphQL */ `mutation MongoRewardDelete($id: ID!) {
  mongoRewardDelete(id: $id)
}
` as GeneratedMutation<
  APITypes.MongoRewardDeleteMutationVariables,
  APITypes.MongoRewardDeleteMutation
>;
export const mongoRewardRedemptionUpdateStatus = /* GraphQL */ `mutation MongoRewardRedemptionUpdateStatus($id: ID!, $status: String!) {
  mongoRewardRedemptionUpdateStatus(id: $id, status: $status) {
    id
    userId
    rewardCode
    pointsCost
    status
    delivery
    clientRequestId
    createdAt
    updatedAt
    createdBy
    updatedBy
    userName
    __typename
  }
}
` as GeneratedMutation<
  APITypes.MongoRewardRedemptionUpdateStatusMutationVariables,
  APITypes.MongoRewardRedemptionUpdateStatusMutation
>;
export const mongoRewardsBalanceSet = /* GraphQL */ `mutation MongoRewardsBalanceSet(
  $userId: ID!
  $availablePoints: Int
  $redeemedPoints: Int
  $reason: String
) {
  mongoRewardsBalanceSet(
    userId: $userId
    availablePoints: $availablePoints
    redeemedPoints: $redeemedPoints
    reason: $reason
  ) {
    ok
    message
    userId
    availablePoints
    redeemedPoints
    totalPoints
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.MongoRewardsBalanceSetMutationVariables,
  APITypes.MongoRewardsBalanceSetMutation
>;
export const createReward = /* GraphQL */ `mutation CreateReward(
  $input: CreateRewardInput!
  $condition: ModelRewardConditionInput
) {
  createReward(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateRewardMutationVariables,
  APITypes.CreateRewardMutation
>;
export const updateReward = /* GraphQL */ `mutation UpdateReward(
  $input: UpdateRewardInput!
  $condition: ModelRewardConditionInput
) {
  updateReward(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateRewardMutationVariables,
  APITypes.UpdateRewardMutation
>;
export const deleteReward = /* GraphQL */ `mutation DeleteReward(
  $input: DeleteRewardInput!
  $condition: ModelRewardConditionInput
) {
  deleteReward(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteRewardMutationVariables,
  APITypes.DeleteRewardMutation
>;
export const createRewardRedemption = /* GraphQL */ `mutation CreateRewardRedemption(
  $input: CreateRewardRedemptionInput!
  $condition: ModelRewardRedemptionConditionInput
) {
  createRewardRedemption(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.CreateRewardRedemptionMutationVariables,
  APITypes.CreateRewardRedemptionMutation
>;
export const updateRewardRedemption = /* GraphQL */ `mutation UpdateRewardRedemption(
  $input: UpdateRewardRedemptionInput!
  $condition: ModelRewardRedemptionConditionInput
) {
  updateRewardRedemption(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.UpdateRewardRedemptionMutationVariables,
  APITypes.UpdateRewardRedemptionMutation
>;
export const deleteRewardRedemption = /* GraphQL */ `mutation DeleteRewardRedemption(
  $input: DeleteRewardRedemptionInput!
  $condition: ModelRewardRedemptionConditionInput
) {
  deleteRewardRedemption(input: $input, condition: $condition) {
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
` as GeneratedMutation<
  APITypes.DeleteRewardRedemptionMutationVariables,
  APITypes.DeleteRewardRedemptionMutation
>;
export const createUserRewardBalance = /* GraphQL */ `mutation CreateUserRewardBalance(
  $input: CreateUserRewardBalanceInput!
  $condition: ModelUserRewardBalanceConditionInput
) {
  createUserRewardBalance(input: $input, condition: $condition) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateUserRewardBalanceMutationVariables,
  APITypes.CreateUserRewardBalanceMutation
>;
export const updateUserRewardBalance = /* GraphQL */ `mutation UpdateUserRewardBalance(
  $input: UpdateUserRewardBalanceInput!
  $condition: ModelUserRewardBalanceConditionInput
) {
  updateUserRewardBalance(input: $input, condition: $condition) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserRewardBalanceMutationVariables,
  APITypes.UpdateUserRewardBalanceMutation
>;
export const deleteUserRewardBalance = /* GraphQL */ `mutation DeleteUserRewardBalance(
  $input: DeleteUserRewardBalanceInput!
  $condition: ModelUserRewardBalanceConditionInput
) {
  deleteUserRewardBalance(input: $input, condition: $condition) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserRewardBalanceMutationVariables,
  APITypes.DeleteUserRewardBalanceMutation
>;
