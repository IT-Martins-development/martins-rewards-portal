// src/lib/rewardsMongo.gql.ts

export const MONGO_REWARD_GET = /* GraphQL */ `
  query MongoRewardGet($id: ID!) {
    mongoRewardGet(id: $id) {
      id
      code
      title { pt en es }
      description { pt en es }
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
    }
  }
`;

export const MONGO_REWARDS_LIST = /* GraphQL */ `
  query MongoRewardsList($limit: Int, $nextToken: String, $activeOnly: Boolean) {
    mongoRewardsList(limit: $limit, nextToken: $nextToken, activeOnly: $activeOnly) {
      items {
        id
        code
        title { pt en es }
        description { pt en es }
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
      }
      nextToken
    }
  }
`;

export const MONGO_REWARD_CREATE = /* GraphQL */ `
  mutation MongoRewardCreate($input: MongoRewardInput!) {
    mongoRewardCreate(input: $input) {
      id
      code
      title { pt en es }
      description { pt en es }
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
    }
  }
`;

export const MONGO_REWARD_UPDATE = /* GraphQL */ `
  mutation MongoRewardUpdate($input: MongoRewardUpdateInput!) {
    mongoRewardUpdate(input: $input) {
      id
      code
      title { pt en es }
      description { pt en es }
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
    }
  }
`;

export const MONGO_REWARD_DELETE = /* GraphQL */ `
  mutation MongoRewardDelete($id: ID!) {
    mongoRewardDelete(id: $id)
  }
`;