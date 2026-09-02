"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PgWrapper = void 0;
exports.getDb = getDb;
exports.closeDb = closeDb;
var pg_1 = require("pg");
var path_1 = require("path");
var fs_1 = require("fs");
var better_sqlite3_1 = require("better-sqlite3");
var pool = null;
var sqliteDb = null;
var PgStatement = /** @class */ (function () {
    function PgStatement(client, sql) {
        this.client = client;
        this.sql = sql;
    }
    PgStatement.prototype.convertSqlAndArgs = function (args) {
        var pgSql = this.sql;
        var pgArgs = __spreadArray([], args, true);
        var count = 1;
        while (pgSql.includes('?')) {
            pgSql = pgSql.replace('?', "$".concat(count));
            count++;
        }
        return { text: pgSql, values: pgArgs };
    };
    PgStatement.prototype.run = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _a, text, values;
            return __generator(this, function (_b) {
                _a = this.convertSqlAndArgs(args), text = _a.text, values = _a.values;
                return [2 /*return*/, this.client.query(text, values)];
            });
        });
    };
    PgStatement.prototype.get = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _a, text, values, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.convertSqlAndArgs(args), text = _a.text, values = _a.values;
                        return [4 /*yield*/, this.client.query(text, values)];
                    case 1:
                        res = _b.sent();
                        return [2 /*return*/, res.rows[0]];
                }
            });
        });
    };
    PgStatement.prototype.all = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _a, text, values, res;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.convertSqlAndArgs(args), text = _a.text, values = _a.values;
                        return [4 /*yield*/, this.client.query(text, values)];
                    case 1:
                        res = _b.sent();
                        return [2 /*return*/, res.rows];
                }
            });
        });
    };
    return PgStatement;
}());
var PgWrapper = /** @class */ (function () {
    function PgWrapper(client) {
        this.client = client;
    }
    PgWrapper.prototype.prepare = function (sql) {
        return new PgStatement(this.client, sql);
    };
    PgWrapper.prototype.exec = function (sql) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.client.query(sql)];
            });
        });
    };
    PgWrapper.prototype.transaction = function (callback) {
        var _this = this;
        return function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, callback()];
            });
        }); };
    };
    return PgWrapper;
}());
exports.PgWrapper = PgWrapper;
var dbWrapper = null;
var isTest = process.env.NODE_ENV === 'test';
function getDb() {
    if (isTest) {
        if (sqliteDb)
            return sqliteDb;
        sqliteDb = new better_sqlite3_1.default(process.env.DB_PATH || ':memory:');
        try {
            var schemaPath = path_1.default.join(__dirname, 'schema.sql');
            var schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
            sqliteDb.exec(schema);
        }
        catch (e) { }
        return sqliteDb;
    }
    if (dbWrapper)
        return dbWrapper;
    pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/policyshield',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    dbWrapper = new PgWrapper(pool);
    if (process.env.NODE_ENV !== 'production') {
        try {
            var schemaPath = path_1.default.join(__dirname, 'schema.sql');
            var schema = fs_1.default.readFileSync(schemaPath, 'utf-8');
            pool.query(schema).catch(function (e) { return console.error("Schema init error:", e); });
        }
        catch (e) {
        }
    }
    return dbWrapper;
}
function closeDb() {
    if (pool) {
        pool.end();
        pool = null;
        dbWrapper = null;
    }
    if (sqliteDb) {
        sqliteDb.close();
        sqliteDb = null;
    }
}
