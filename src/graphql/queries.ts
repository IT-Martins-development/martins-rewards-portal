/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getPublicUrl = /* GraphQL */ `query GetPublicUrl($key: String!) {
  getPublicUrl(key: $key) {
    url
    expiresIn
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetPublicUrlQueryVariables,
  APITypes.GetPublicUrlQuery
>;
export const mongoRewardGet = /* GraphQL */ `query MongoRewardGet($id: ID!) {
  mongoRewardGet(id: $id) {
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
` as GeneratedQuery<
  APITypes.MongoRewardGetQueryVariables,
  APITypes.MongoRewardGetQuery
>;
export const mongoRewardsList = /* GraphQL */ `query MongoRewardsList($limit: Int, $nextToken: String, $activeOnly: Boolean) {
  mongoRewardsList(
    limit: $limit
    nextToken: $nextToken
    activeOnly: $activeOnly
  ) {
    items {
      id
      code
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MongoRewardsListQueryVariables,
  APITypes.MongoRewardsListQuery
>;
export const mongoRewardRedemptionsList = /* GraphQL */ `query MongoRewardRedemptionsList(
  $status: String
  $limit: Int
  $nextToken: String
) {
  mongoRewardRedemptionsList(
    status: $status
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MongoRewardRedemptionsListQueryVariables,
  APITypes.MongoRewardRedemptionsListQuery
>;
export const mongoUsersList = /* GraphQL */ `query MongoUsersList($limit: Int, $nextToken: String) {
  mongoUsersList(limit: $limit, nextToken: $nextToken) {
    items {
      _id
      fullName
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MongoUsersListQueryVariables,
  APITypes.MongoUsersListQuery
>;
export const mongoRewardsLedgerReport = /* GraphQL */ `query MongoRewardsLedgerReport(
  $from: AWSDateTime
  $to: AWSDateTime
  $statuses: [String]
  $limit: Int
  $nextToken: String
  $lang: String
) {
  mongoRewardsLedgerReport(
    from: $from
    to: $to
    statuses: $statuses
    limit: $limit
    nextToken: $nextToken
    lang: $lang
  ) {
    items {
      id
      userId
      rewardId
      pointsSpent
      status
      createdAt
      updatedAt
      rewardName
      deliveryType
      userName
      userEmail
      userPhone
      userType
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MongoRewardsLedgerReportQueryVariables,
  APITypes.MongoRewardsLedgerReportQuery
>;
export const mongoRewardsBalancesList = /* GraphQL */ `query MongoRewardsBalancesList(
  $limit: Int
  $nextToken: String
  $name: String
  $userType: String
) {
  mongoRewardsBalancesList(
    limit: $limit
    nextToken: $nextToken
    name: $name
    userType: $userType
  ) {
    items {
      userId
      userName
      userType
      userEmail
      userPhone
      availablePoints
      redeemedPoints
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.MongoRewardsBalancesListQueryVariables,
  APITypes.MongoRewardsBalancesListQuery
>;
export const getReward = /* GraphQL */ `query GetReward($id: ID!) {
  getReward(id: $id) {
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
` as GeneratedQuery<APITypes.GetRewardQueryVariables, APITypes.GetRewardQuery>;
export const listRewards = /* GraphQL */ `query ListRewards(
  $filter: ModelRewardFilterInput
  $limit: Int
  $nextToken: String
) {
  listRewards(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListRewardsQueryVariables,
  APITypes.ListRewardsQuery
>;
export const getRewardRedemption = /* GraphQL */ `query GetRewardRedemption($id: ID!) {
  getRewardRedemption(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetRewardRedemptionQueryVariables,
  APITypes.GetRewardRedemptionQuery
>;
export const listRewardRedemptions = /* GraphQL */ `query ListRewardRedemptions(
  $filter: ModelRewardRedemptionFilterInput
  $limit: Int
  $nextToken: String
) {
  listRewardRedemptions(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      userId
      rewardId
      pointsSpent
      status
      createdAt
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListRewardRedemptionsQueryVariables,
  APITypes.ListRewardRedemptionsQuery
>;
export const getUserRewardBalance = /* GraphQL */ `query GetUserRewardBalance($id: ID!) {
  getUserRewardBalance(id: $id) {
    id
    userId
    pointsBalance
    updatedAt
    createdAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserRewardBalanceQueryVariables,
  APITypes.GetUserRewardBalanceQuery
>;
export const listUserRewardBalances = /* GraphQL */ `query ListUserRewardBalances(
  $filter: ModelUserRewardBalanceFilterInput
  $limit: Int
  $nextToken: String
) {
  listUserRewardBalances(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
      userId
      pointsBalance
      updatedAt
      createdAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserRewardBalancesQueryVariables,
  APITypes.ListUserRewardBalancesQuery
>;
