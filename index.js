'use strict';

const moment = require('moment');
const _ = require('lodash');

const converter = function(type, value) {
    if(type === 'date_tz' && _.get(value,'utcMillis')) {
        return moment(_.get(value,'utcMillis')).toDate()
    }
    return value;
};

exports.register = function (server, opts, next) {
    /*
        monkey patch mssql connection at runtime so parameters will be converted to timestamps
     */
    const mssqlDriver = server.dm('datasource').drivers['mssql-jdbc'];
    const oldGetConnection = _.bind(mssqlDriver.getConnection,mssqlDriver);
    mssqlDriver.getConnection = function (datasource) {
        return oldGetConnection(datasource)
            .then(disposer => {
                disposer._promise = disposer._promise.tap(conn => {
                    conn.javaSQLTypes([
                        {
                            typeName: 'DATETIMEOFFSET',
                            typeNumber: -155,
                            className: 'java.sql.Timestamp'
                        }
                    ]);
                });
                return disposer;
            })
    };
    /*
        converter to display the datetimeoffsets correctly
     */
    server.dm('dataType').intercept({
        parse: (type, rawType, value, next) => {
            return next();
        },
        convert: (type, value, next) => {
            if(type === 'date_tz') {
                if(_.isArray(value)) {
                    return _.map(value, v => converter(type, v));
                }
                return converter(type, value);
            }
            return next();
        }
    });

    /*
        scan a datetimeoffset as a timestamp
     */
    server.app.ext('datasource.scannedItem', (ds, itemModel, itemType) => {
        if(itemType === 'field' && _.get(itemModel,'rawType') === 'datetimeoffset') {
            itemModel.dataType = 'date_tz';
        }
    });

    next();
};

exports.converter = converter;

exports.register.attributes = { name: 'informer-msdatetimeoffset' };
