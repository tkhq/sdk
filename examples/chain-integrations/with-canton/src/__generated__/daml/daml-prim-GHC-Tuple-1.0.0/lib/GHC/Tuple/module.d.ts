// Generated from ../../GHC/Tuple/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Unit<a> = {
  _1: a,
}

export declare const Unit:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Unit<a>>
