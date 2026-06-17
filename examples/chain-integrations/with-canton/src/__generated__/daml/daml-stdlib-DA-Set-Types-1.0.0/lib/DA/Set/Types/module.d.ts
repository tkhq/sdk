// Generated from ../../../DA/Set/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Set<k> = {
  map: damlTypes.Map<k, {}>,
}

export declare const Set:
  <k>(k: damlTypes.Serializable<k>) => damlTypes.Serializable<Set<k>>
