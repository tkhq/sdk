// Generated from ../../../DA/Semigroup/Types/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Max<a> = {
  unpack: a,
}

export declare const Max:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Max<a>>

export declare type Min<a> = {
  unpack: a,
}

export declare const Min:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Min<a>>
