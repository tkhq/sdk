// Generated from ../../../DA/Internal/Down/module.daml

/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-use-before-define */
import * as jtv from '@mojotech/json-type-validation';
import * as damlTypes from '@daml/types';

export declare type Down<a> = {
  unpack: a,
}

export declare const Down:
  <a>(a: damlTypes.Serializable<a>) => damlTypes.Serializable<Down<a>>
