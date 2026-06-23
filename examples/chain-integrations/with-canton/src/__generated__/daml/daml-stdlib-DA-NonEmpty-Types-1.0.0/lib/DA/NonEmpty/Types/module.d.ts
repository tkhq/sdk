// Generated from ../../../DA/NonEmpty/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type NonEmpty<a> = {
  hd: a,
  tl: a[],
}

export declare const NonEmpty:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<NonEmpty<a>>
