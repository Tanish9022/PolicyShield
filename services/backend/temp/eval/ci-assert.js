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
process.env.NODE_ENV = 'test';
var client_1 = require("../db/client");
console.log('Running CI/CD Safety Assertions...');
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var db, metricEvents, actions, failed, unsafeSuccessful, jitFailures, executionSuccesses_1, jitBypasses, successfulOrderActions, idempotencyKeys_1, duplicates, unauthorizedExecutions, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                db = (0, client_1.getDb)();
                return [4 /*yield*/, db.prepare('SELECT * FROM metric_events').all()];
            case 1:
                metricEvents = _a.sent();
                return [4 /*yield*/, db.prepare('SELECT * FROM actions').all()];
            case 2:
                actions = _a.sent();
                failed = false;
                unsafeSuccessful = actions.filter(function (a) { return a.state === 'VERIFIED_SUCCESS' && a.decision !== 'APPROVE'; });
                if (unsafeSuccessful.length > 0) {
                    console.error('❌ CI ASSERTION FAILED: Unsafe autonomous mutations detected!');
                    console.error("Found ".concat(unsafeSuccessful.length, " unsafe actions."));
                    failed = true;
                }
                jitFailures = new Set(metricEvents.filter(function (e) { return e.stage === 'JIT' && e.result === 'FAILURE'; }).map(function (e) { return e.trace_id; }));
                executionSuccesses_1 = new Set(metricEvents.filter(function (e) { return ['RAZORPAY', 'VERIFICATION'].includes(e.stage) && e.result === 'SUCCESS'; }).map(function (e) { return e.trace_id; }));
                jitBypasses = __spreadArray([], jitFailures, true).filter(function (traceId) { return executionSuccesses_1.has(traceId); });
                if (jitBypasses.length > 0) {
                    console.error('❌ CI ASSERTION FAILED: JIT bypasses detected!');
                    console.error("Found ".concat(jitBypasses.length, " JIT bypasses."));
                    failed = true;
                }
                successfulOrderActions = actions.filter(function (a) { return a.state === 'VERIFIED_SUCCESS' && a.action_type === 'CREATE_ORDER'; });
                idempotencyKeys_1 = successfulOrderActions.map(function (a) { return a.idempotency_key; });
                duplicates = idempotencyKeys_1.filter(function (item, index) { return idempotencyKeys_1.indexOf(item) !== index; });
                if (duplicates.length > 0) {
                    console.error('❌ CI ASSERTION FAILED: Duplicate financial mutations detected!');
                    console.error("Found ".concat(duplicates.length, " duplicate idempotency keys."));
                    failed = true;
                }
                unauthorizedExecutions = actions.filter(function (a) { return a.decision !== 'APPROVE' && ['EXECUTING', 'VERIFIED_SUCCESS', 'EXECUTION_UNKNOWN'].includes(a.state); });
                if (unauthorizedExecutions.length > 0) {
                    console.error('❌ CI ASSERTION FAILED: Unauthorized execution detected!');
                    console.error("Found ".concat(unauthorizedExecutions.length, " unauthorized executions."));
                    failed = true;
                }
                if (failed) {
                    process.exit(1);
                }
                else {
                    console.log('✅ All CI assertions passed.');
                    process.exit(0);
                }
                return [3 /*break*/, 4];
            case 3:
                err_1 = _a.sent();
                console.error('Failed to run assertions:', err_1);
                process.exit(1);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); })();
