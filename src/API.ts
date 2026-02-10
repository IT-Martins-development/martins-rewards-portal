/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type PresignedUpload = {
  __typename: "PresignedUpload",
  key: string,
  uploadUrl: string,
  expiresIn?: number | null,
};

export type MongoRewardInput = {
  code: string,
  title: MongoI18nInput,
  description?: MongoI18nInput | null,
  category?: string | null,
  tags?: Array< string > | null,
  pointsCost: number,
  imageUrl?: string | null,
  imageKey?: string | null,
  deliveryType: string,
  active: boolean,
  offerStartAt?: string | null,
  offerEndAt?: string | null,
};

export type MongoI18nInput = {
  pt?: string | null,
  en?: string | null,
  es?: string | null,
};

export type MongoReward = {
  __typename: "MongoReward",
  id: string,
  code: string,
  title: MongoI18n,
  description?: MongoI18n | null,
  category?: string | null,
  tags?: Array< string > | null,
  pointsCost: number,
  imageUrl?: string | null,
  deliveryType: string,
  active: boolean,
  offerStartAt?: string | null,
  offerEndAt?: string | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  createdBy?: string | null,
};

export type MongoI18n = {
  __typename: "MongoI18n",
  pt?: string | null,
  en?: string | null,
  es?: string | null,
};

export type MongoRewardUpdateInput = {
  id: string,
  code?: string | null,
  title?: MongoI18nInput | null,
  description?: MongoI18nInput | null,
  category?: string | null,
  tags?: Array< string > | null,
  pointsCost?: number | null,
  imageUrl?: string | null,
  imageKey?: string | null,
  deliveryType?: string | null,
  active?: boolean | null,
  offerStartAt?: string | null,
  offerEndAt?: string | null,
};

export type MongoRewardRedemption = {
  __typename: "MongoRewardRedemption",
  id: string,
  userId?: string | null,
  rewardCode?: string | null,
  pointsCost?: number | null,
  status?: string | null,
  delivery?: string | null,
  clientRequestId?: string | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  createdBy?: string | null,
  updatedBy?: string | null,
  userName?: string | null,
};

export type MongoRewardsBalanceSetResult = {
  __typename: "MongoRewardsBalanceSetResult",
  ok: boolean,
  message?: string | null,
  userId: string,
  availablePoints: number,
  redeemedPoints: number,
  totalPoints: number,
  updatedAt?: string | null,
};

export type CreateRewardInput = {
  id?: string | null,
  title: string,
  description?: string | null,
  pointsCost: number,
  isActive: boolean,
  imageUrl?: string | null,
};

export type ModelRewardConditionInput = {
  title?: ModelStringInput | null,
  description?: ModelStringInput | null,
  pointsCost?: ModelIntInput | null,
  isActive?: ModelBooleanInput | null,
  imageUrl?: ModelStringInput | null,
  and?: Array< ModelRewardConditionInput | null > | null,
  or?: Array< ModelRewardConditionInput | null > | null,
  not?: ModelRewardConditionInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
  _null = "_null",
}


export type ModelSizeInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
};

export type ModelIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type ModelBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
};

export type Reward = {
  __typename: "Reward",
  id: string,
  title: string,
  description?: string | null,
  pointsCost: number,
  isActive: boolean,
  imageUrl?: string | null,
  createdAt: string,
  updatedAt: string,
};

export type UpdateRewardInput = {
  id: string,
  title?: string | null,
  description?: string | null,
  pointsCost?: number | null,
  isActive?: boolean | null,
  imageUrl?: string | null,
};

export type DeleteRewardInput = {
  id: string,
};

export type CreateRewardRedemptionInput = {
  id?: string | null,
  userId?: string | null,
  rewardId: string,
  pointsSpent: number,
  status: RedemptionStatus,
  createdAt?: string | null,
};

export enum RedemptionStatus {
  REQUESTED = "REQUESTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  FULFILLED = "FULFILLED",
  CANCELED = "CANCELED",
}


export type ModelRewardRedemptionConditionInput = {
  userId?: ModelIDInput | null,
  rewardId?: ModelIDInput | null,
  pointsSpent?: ModelIntInput | null,
  status?: ModelRedemptionStatusInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelRewardRedemptionConditionInput | null > | null,
  or?: Array< ModelRewardRedemptionConditionInput | null > | null,
  not?: ModelRewardRedemptionConditionInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  size?: ModelSizeInput | null,
};

export type ModelRedemptionStatusInput = {
  eq?: RedemptionStatus | null,
  ne?: RedemptionStatus | null,
};

export type RewardRedemption = {
  __typename: "RewardRedemption",
  id: string,
  userId?: string | null,
  rewardId: string,
  pointsSpent: number,
  status: RedemptionStatus,
  createdAt?: string | null,
  updatedAt: string,
};

export type UpdateRewardRedemptionInput = {
  id: string,
  userId?: string | null,
  rewardId?: string | null,
  pointsSpent?: number | null,
  status?: RedemptionStatus | null,
  createdAt?: string | null,
};

export type DeleteRewardRedemptionInput = {
  id: string,
};

export type CreateUserRewardBalanceInput = {
  id?: string | null,
  userId: string,
  pointsBalance: number,
  updatedAt?: string | null,
};

export type ModelUserRewardBalanceConditionInput = {
  userId?: ModelIDInput | null,
  pointsBalance?: ModelIntInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelUserRewardBalanceConditionInput | null > | null,
  or?: Array< ModelUserRewardBalanceConditionInput | null > | null,
  not?: ModelUserRewardBalanceConditionInput | null,
  createdAt?: ModelStringInput | null,
};

export type UserRewardBalance = {
  __typename: "UserRewardBalance",
  id: string,
  userId: string,
  pointsBalance: number,
  updatedAt?: string | null,
  createdAt: string,
};

export type UpdateUserRewardBalanceInput = {
  id: string,
  userId?: string | null,
  pointsBalance?: number | null,
  updatedAt?: string | null,
};

export type DeleteUserRewardBalanceInput = {
  id: string,
};

export type PresignedGet = {
  __typename: "PresignedGet",
  url: string,
  expiresIn?: number | null,
};

export type MongoRewardsList = {
  __typename: "MongoRewardsList",
  items:  Array<MongoReward >,
  nextToken?: string | null,
};

export type MongoRewardRedemptionsList = {
  __typename: "MongoRewardRedemptionsList",
  items:  Array<MongoRewardRedemption >,
  nextToken?: string | null,
};

export type MongoUsersConnection = {
  __typename: "MongoUsersConnection",
  items:  Array<MongoUser >,
  nextToken?: string | null,
};

export type MongoUser = {
  __typename: "MongoUser",
  _id: string,
  fullName?: string | null,
};

export type MongoRewardsLedgerReportConnection = {
  __typename: "MongoRewardsLedgerReportConnection",
  items:  Array<MongoRewardsLedgerReportItem >,
  nextToken?: string | null,
};

export type MongoRewardsLedgerReportItem = {
  __typename: "MongoRewardsLedgerReportItem",
  id: string,
  userId?: string | null,
  rewardId?: string | null,
  pointsSpent?: number | null,
  status?: string | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  rewardName?: string | null,
  deliveryType?: string | null,
  userName?: string | null,
  userEmail?: string | null,
  userPhone?: string | null,
  userType?: string | null,
};

export type MongoRewardsBalancesList = {
  __typename: "MongoRewardsBalancesList",
  items:  Array<MongoRewardsBalanceRow >,
  nextToken?: string | null,
};

export type MongoRewardsBalanceRow = {
  __typename: "MongoRewardsBalanceRow",
  userId: string,
  userName?: string | null,
  userType?: string | null,
  userEmail?: string | null,
  userPhone?: string | null,
  availablePoints: number,
  redeemedPoints: number,
  updatedAt?: string | null,
};

export type ModelRewardFilterInput = {
  id?: ModelIDInput | null,
  title?: ModelStringInput | null,
  description?: ModelStringInput | null,
  pointsCost?: ModelIntInput | null,
  isActive?: ModelBooleanInput | null,
  imageUrl?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelRewardFilterInput | null > | null,
  or?: Array< ModelRewardFilterInput | null > | null,
  not?: ModelRewardFilterInput | null,
};

export type ModelRewardConnection = {
  __typename: "ModelRewardConnection",
  items:  Array<Reward | null >,
  nextToken?: string | null,
};

export type ModelRewardRedemptionFilterInput = {
  id?: ModelIDInput | null,
  userId?: ModelIDInput | null,
  rewardId?: ModelIDInput | null,
  pointsSpent?: ModelIntInput | null,
  status?: ModelRedemptionStatusInput | null,
  createdAt?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  and?: Array< ModelRewardRedemptionFilterInput | null > | null,
  or?: Array< ModelRewardRedemptionFilterInput | null > | null,
  not?: ModelRewardRedemptionFilterInput | null,
};

export type ModelRewardRedemptionConnection = {
  __typename: "ModelRewardRedemptionConnection",
  items:  Array<RewardRedemption | null >,
  nextToken?: string | null,
};

export type ModelUserRewardBalanceFilterInput = {
  id?: ModelIDInput | null,
  userId?: ModelIDInput | null,
  pointsBalance?: ModelIntInput | null,
  updatedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  and?: Array< ModelUserRewardBalanceFilterInput | null > | null,
  or?: Array< ModelUserRewardBalanceFilterInput | null > | null,
  not?: ModelUserRewardBalanceFilterInput | null,
};

export type ModelUserRewardBalanceConnection = {
  __typename: "ModelUserRewardBalanceConnection",
  items:  Array<UserRewardBalance | null >,
  nextToken?: string | null,
};

export type ModelSubscriptionRewardFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  title?: ModelSubscriptionStringInput | null,
  description?: ModelSubscriptionStringInput | null,
  pointsCost?: ModelSubscriptionIntInput | null,
  isActive?: ModelSubscriptionBooleanInput | null,
  imageUrl?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionRewardFilterInput | null > | null,
  or?: Array< ModelSubscriptionRewardFilterInput | null > | null,
};

export type ModelSubscriptionIDInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionStringInput = {
  ne?: string | null,
  eq?: string | null,
  le?: string | null,
  lt?: string | null,
  ge?: string | null,
  gt?: string | null,
  contains?: string | null,
  notContains?: string | null,
  between?: Array< string | null > | null,
  beginsWith?: string | null,
  in?: Array< string | null > | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionIntInput = {
  ne?: number | null,
  eq?: number | null,
  le?: number | null,
  lt?: number | null,
  ge?: number | null,
  gt?: number | null,
  between?: Array< number | null > | null,
  in?: Array< number | null > | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionBooleanInput = {
  ne?: boolean | null,
  eq?: boolean | null,
};

export type ModelSubscriptionRewardRedemptionFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  rewardId?: ModelSubscriptionIDInput | null,
  pointsSpent?: ModelSubscriptionIntInput | null,
  status?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionRewardRedemptionFilterInput | null > | null,
  or?: Array< ModelSubscriptionRewardRedemptionFilterInput | null > | null,
  userId?: ModelStringInput | null,
};

export type ModelSubscriptionUserRewardBalanceFilterInput = {
  id?: ModelSubscriptionIDInput | null,
  userId?: ModelSubscriptionIDInput | null,
  pointsBalance?: ModelSubscriptionIntInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionUserRewardBalanceFilterInput | null > | null,
  or?: Array< ModelSubscriptionUserRewardBalanceFilterInput | null > | null,
};

export type _noopMutationVariables = {
};

export type _noopMutation = {
  _noop?: string | null,
};

export type PresignUploadMutationVariables = {
  key: string,
  contentType?: string | null,
};

export type PresignUploadMutation = {
  presignUpload?:  {
    __typename: "PresignedUpload",
    key: string,
    uploadUrl: string,
    expiresIn?: number | null,
  } | null,
};

export type MongoRewardCreateMutationVariables = {
  input: MongoRewardInput,
};

export type MongoRewardCreateMutation = {
  mongoRewardCreate:  {
    __typename: "MongoReward",
    id: string,
    code: string,
    title:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    },
    description?:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    } | null,
    category?: string | null,
    tags?: Array< string > | null,
    pointsCost: number,
    imageUrl?: string | null,
    deliveryType: string,
    active: boolean,
    offerStartAt?: string | null,
    offerEndAt?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    createdBy?: string | null,
  },
};

export type MongoRewardUpdateMutationVariables = {
  input: MongoRewardUpdateInput,
};

export type MongoRewardUpdateMutation = {
  mongoRewardUpdate:  {
    __typename: "MongoReward",
    id: string,
    code: string,
    title:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    },
    description?:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    } | null,
    category?: string | null,
    tags?: Array< string > | null,
    pointsCost: number,
    imageUrl?: string | null,
    deliveryType: string,
    active: boolean,
    offerStartAt?: string | null,
    offerEndAt?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    createdBy?: string | null,
  },
};

export type MongoRewardDeleteMutationVariables = {
  id: string,
};

export type MongoRewardDeleteMutation = {
  mongoRewardDelete: boolean,
};

export type MongoRewardRedemptionUpdateStatusMutationVariables = {
  id: string,
  status: string,
};

export type MongoRewardRedemptionUpdateStatusMutation = {
  mongoRewardRedemptionUpdateStatus?:  {
    __typename: "MongoRewardRedemption",
    id: string,
    userId?: string | null,
    rewardCode?: string | null,
    pointsCost?: number | null,
    status?: string | null,
    delivery?: string | null,
    clientRequestId?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    createdBy?: string | null,
    updatedBy?: string | null,
    userName?: string | null,
  } | null,
};

export type MongoRewardsBalanceSetMutationVariables = {
  userId: string,
  availablePoints?: number | null,
  redeemedPoints?: number | null,
  reason?: string | null,
};

export type MongoRewardsBalanceSetMutation = {
  mongoRewardsBalanceSet:  {
    __typename: "MongoRewardsBalanceSetResult",
    ok: boolean,
    message?: string | null,
    userId: string,
    availablePoints: number,
    redeemedPoints: number,
    totalPoints: number,
    updatedAt?: string | null,
  },
};

export type CreateRewardMutationVariables = {
  input: CreateRewardInput,
  condition?: ModelRewardConditionInput | null,
};

export type CreateRewardMutation = {
  createReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type UpdateRewardMutationVariables = {
  input: UpdateRewardInput,
  condition?: ModelRewardConditionInput | null,
};

export type UpdateRewardMutation = {
  updateReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type DeleteRewardMutationVariables = {
  input: DeleteRewardInput,
  condition?: ModelRewardConditionInput | null,
};

export type DeleteRewardMutation = {
  deleteReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type CreateRewardRedemptionMutationVariables = {
  input: CreateRewardRedemptionInput,
  condition?: ModelRewardRedemptionConditionInput | null,
};

export type CreateRewardRedemptionMutation = {
  createRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type UpdateRewardRedemptionMutationVariables = {
  input: UpdateRewardRedemptionInput,
  condition?: ModelRewardRedemptionConditionInput | null,
};

export type UpdateRewardRedemptionMutation = {
  updateRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type DeleteRewardRedemptionMutationVariables = {
  input: DeleteRewardRedemptionInput,
  condition?: ModelRewardRedemptionConditionInput | null,
};

export type DeleteRewardRedemptionMutation = {
  deleteRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type CreateUserRewardBalanceMutationVariables = {
  input: CreateUserRewardBalanceInput,
  condition?: ModelUserRewardBalanceConditionInput | null,
};

export type CreateUserRewardBalanceMutation = {
  createUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type UpdateUserRewardBalanceMutationVariables = {
  input: UpdateUserRewardBalanceInput,
  condition?: ModelUserRewardBalanceConditionInput | null,
};

export type UpdateUserRewardBalanceMutation = {
  updateUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type DeleteUserRewardBalanceMutationVariables = {
  input: DeleteUserRewardBalanceInput,
  condition?: ModelUserRewardBalanceConditionInput | null,
};

export type DeleteUserRewardBalanceMutation = {
  deleteUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type GetPublicUrlQueryVariables = {
  key: string,
};

export type GetPublicUrlQuery = {
  getPublicUrl?:  {
    __typename: "PresignedGet",
    url: string,
    expiresIn?: number | null,
  } | null,
};

export type MongoRewardGetQueryVariables = {
  id: string,
};

export type MongoRewardGetQuery = {
  mongoRewardGet?:  {
    __typename: "MongoReward",
    id: string,
    code: string,
    title:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    },
    description?:  {
      __typename: "MongoI18n",
      pt?: string | null,
      en?: string | null,
      es?: string | null,
    } | null,
    category?: string | null,
    tags?: Array< string > | null,
    pointsCost: number,
    imageUrl?: string | null,
    deliveryType: string,
    active: boolean,
    offerStartAt?: string | null,
    offerEndAt?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    createdBy?: string | null,
  } | null,
};

export type MongoRewardsListQueryVariables = {
  limit?: number | null,
  nextToken?: string | null,
  activeOnly?: boolean | null,
};

export type MongoRewardsListQuery = {
  mongoRewardsList?:  {
    __typename: "MongoRewardsList",
    items:  Array< {
      __typename: "MongoReward",
      id: string,
      code: string,
      category?: string | null,
      tags?: Array< string > | null,
      pointsCost: number,
      imageUrl?: string | null,
      deliveryType: string,
      active: boolean,
      offerStartAt?: string | null,
      offerEndAt?: string | null,
      createdAt?: string | null,
      updatedAt?: string | null,
      createdBy?: string | null,
    } >,
    nextToken?: string | null,
  } | null,
};

export type MongoRewardRedemptionsListQueryVariables = {
  status?: string | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type MongoRewardRedemptionsListQuery = {
  mongoRewardRedemptionsList?:  {
    __typename: "MongoRewardRedemptionsList",
    items:  Array< {
      __typename: "MongoRewardRedemption",
      id: string,
      userId?: string | null,
      rewardCode?: string | null,
      pointsCost?: number | null,
      status?: string | null,
      delivery?: string | null,
      clientRequestId?: string | null,
      createdAt?: string | null,
      updatedAt?: string | null,
      createdBy?: string | null,
      updatedBy?: string | null,
      userName?: string | null,
    } >,
    nextToken?: string | null,
  } | null,
};

export type MongoUsersListQueryVariables = {
  limit?: number | null,
  nextToken?: string | null,
};

export type MongoUsersListQuery = {
  mongoUsersList:  {
    __typename: "MongoUsersConnection",
    items:  Array< {
      __typename: "MongoUser",
      _id: string,
      fullName?: string | null,
    } >,
    nextToken?: string | null,
  },
};

export type MongoRewardsLedgerReportQueryVariables = {
  from?: string | null,
  to?: string | null,
  statuses?: Array< string | null > | null,
  limit?: number | null,
  nextToken?: string | null,
  lang?: string | null,
};

export type MongoRewardsLedgerReportQuery = {
  mongoRewardsLedgerReport:  {
    __typename: "MongoRewardsLedgerReportConnection",
    items:  Array< {
      __typename: "MongoRewardsLedgerReportItem",
      id: string,
      userId?: string | null,
      rewardId?: string | null,
      pointsSpent?: number | null,
      status?: string | null,
      createdAt?: string | null,
      updatedAt?: string | null,
      rewardName?: string | null,
      deliveryType?: string | null,
      userName?: string | null,
      userEmail?: string | null,
      userPhone?: string | null,
      userType?: string | null,
    } >,
    nextToken?: string | null,
  },
};

export type MongoRewardsBalancesListQueryVariables = {
  limit?: number | null,
  nextToken?: string | null,
  name?: string | null,
  userType?: string | null,
};

export type MongoRewardsBalancesListQuery = {
  mongoRewardsBalancesList:  {
    __typename: "MongoRewardsBalancesList",
    items:  Array< {
      __typename: "MongoRewardsBalanceRow",
      userId: string,
      userName?: string | null,
      userType?: string | null,
      userEmail?: string | null,
      userPhone?: string | null,
      availablePoints: number,
      redeemedPoints: number,
      updatedAt?: string | null,
    } >,
    nextToken?: string | null,
  },
};

export type GetRewardQueryVariables = {
  id: string,
};

export type GetRewardQuery = {
  getReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListRewardsQueryVariables = {
  filter?: ModelRewardFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListRewardsQuery = {
  listRewards?:  {
    __typename: "ModelRewardConnection",
    items:  Array< {
      __typename: "Reward",
      id: string,
      title: string,
      description?: string | null,
      pointsCost: number,
      isActive: boolean,
      imageUrl?: string | null,
      createdAt: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetRewardRedemptionQueryVariables = {
  id: string,
};

export type GetRewardRedemptionQuery = {
  getRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type ListRewardRedemptionsQueryVariables = {
  filter?: ModelRewardRedemptionFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListRewardRedemptionsQuery = {
  listRewardRedemptions?:  {
    __typename: "ModelRewardRedemptionConnection",
    items:  Array< {
      __typename: "RewardRedemption",
      id: string,
      userId?: string | null,
      rewardId: string,
      pointsSpent: number,
      status: RedemptionStatus,
      createdAt?: string | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserRewardBalanceQueryVariables = {
  id: string,
};

export type GetUserRewardBalanceQuery = {
  getUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type ListUserRewardBalancesQueryVariables = {
  filter?: ModelUserRewardBalanceFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListUserRewardBalancesQuery = {
  listUserRewardBalances?:  {
    __typename: "ModelUserRewardBalanceConnection",
    items:  Array< {
      __typename: "UserRewardBalance",
      id: string,
      userId: string,
      pointsBalance: number,
      updatedAt?: string | null,
      createdAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type OnCreateRewardSubscriptionVariables = {
  filter?: ModelSubscriptionRewardFilterInput | null,
};

export type OnCreateRewardSubscription = {
  onCreateReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateRewardSubscriptionVariables = {
  filter?: ModelSubscriptionRewardFilterInput | null,
};

export type OnUpdateRewardSubscription = {
  onUpdateReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteRewardSubscriptionVariables = {
  filter?: ModelSubscriptionRewardFilterInput | null,
};

export type OnDeleteRewardSubscription = {
  onDeleteReward?:  {
    __typename: "Reward",
    id: string,
    title: string,
    description?: string | null,
    pointsCost: number,
    isActive: boolean,
    imageUrl?: string | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type OnCreateRewardRedemptionSubscriptionVariables = {
  filter?: ModelSubscriptionRewardRedemptionFilterInput | null,
  userId?: string | null,
};

export type OnCreateRewardRedemptionSubscription = {
  onCreateRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateRewardRedemptionSubscriptionVariables = {
  filter?: ModelSubscriptionRewardRedemptionFilterInput | null,
  userId?: string | null,
};

export type OnUpdateRewardRedemptionSubscription = {
  onUpdateRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteRewardRedemptionSubscriptionVariables = {
  filter?: ModelSubscriptionRewardRedemptionFilterInput | null,
  userId?: string | null,
};

export type OnDeleteRewardRedemptionSubscription = {
  onDeleteRewardRedemption?:  {
    __typename: "RewardRedemption",
    id: string,
    userId?: string | null,
    rewardId: string,
    pointsSpent: number,
    status: RedemptionStatus,
    createdAt?: string | null,
    updatedAt: string,
  } | null,
};

export type OnCreateUserRewardBalanceSubscriptionVariables = {
  filter?: ModelSubscriptionUserRewardBalanceFilterInput | null,
};

export type OnCreateUserRewardBalanceSubscription = {
  onCreateUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type OnUpdateUserRewardBalanceSubscriptionVariables = {
  filter?: ModelSubscriptionUserRewardBalanceFilterInput | null,
};

export type OnUpdateUserRewardBalanceSubscription = {
  onUpdateUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};

export type OnDeleteUserRewardBalanceSubscriptionVariables = {
  filter?: ModelSubscriptionUserRewardBalanceFilterInput | null,
};

export type OnDeleteUserRewardBalanceSubscription = {
  onDeleteUserRewardBalance?:  {
    __typename: "UserRewardBalance",
    id: string,
    userId: string,
    pointsBalance: number,
    updatedAt?: string | null,
    createdAt: string,
  } | null,
};
