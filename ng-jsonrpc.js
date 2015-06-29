"use strict";

(function (angular) {

    var module = angular.module("educ.ngJsonRpc", []);
    
    module.service("JsonRpc", ["$q", "$timeout", "$http", function ($q, $timeout, $http) {

        this.entrypoint = function (url) {
            return new JsonRpcClient(url);
        };

        var requestCounter = 0;

        function e(code, method) {
            return {
                error: code,
                module: "JsonRpcService",
                method: method
            };
        }

        function JsonRpcClient(url) {
            this.url = url;
            this.timeout = 60 * 1000; // ms
        }

        JsonRpcClient.prototype.call = function (method, params) {
            var request = {
                id: ++requestCounter,
                method: method,
                params: params
            };
            var data = JSON.stringify(request);
            console.log("JSON-RPC", request.id, "POST", this.url);
            console.log("JSON-RPC", request.id, "->", data);
            var defer = $q.defer();
            var canceler = $q.defer();
            var cancelOrTimeout = false;
            canceler.promise.then(function (x) {
                cancelOrTimeout = x;
            });
            var timeoutPromise = $timeout(function () {
                canceler.resolve({status: "timeout"});
            }, this.timeout);
            $http({
                method: "POST",
                url: this.url,
                data: data,
                timeout: canceler.promise,
                withCredentials: true
            })
                .success(function (response) {
                    $timeout.cancel(timeoutPromise);
                    if (response) {
                        if (response['debug'] !== undefined && response['debug'] !== null && response['debug'].length > 0) {
                            console.error("debug", response.debug);
                        }
                        if (response['error'] !== undefined && response['error'] !== null) {
                            console.log("JSON-RPC", request.id, "<- NOK", response.error);
                            defer.reject(e(response.error, request.method));
                        } else if (response['result'] !== undefined && response['result'] !== null) {
                            console.log("JSON-RPC", request.id, "<- OK", response.result);
                            defer.resolve(response.result);
                        } else {
                            console.log("JSON-RPC", request.id, "<- NOK", response);
                            defer.reject(e("bad-response", "call"));
                        }
                    } else {
                        console.log("JSON-RPC", request.id, "<- NOK", response);
                        defer.reject(e("empty-response", "call"));
                    }
                })
                .error(function (data, status /*, headers, config*/) {
                    $timeout.cancel(timeoutPromise);
                    if (cancelOrTimeout.status === "canceled") {
                        console.log("JSON-RPC", request.id, "<- NOK", "(canceled)");
                        defer.reject(e("canceled", "call"));
                    } else if (cancelOrTimeout.status === "timeout") {
                        console.log("JSON-RPC", request.id, "<- NOK", "(timeout)");
                        defer.reject(e("timeout", "call"));
                    } else {
                        console.log("JSON-RPC", request.id, "<- NOK status", data);
                        defer.reject(e(status, "call"));
                    }
                })
            ;
            return {
                request: request,
                promise: defer.promise,
                abort: function () {
                    canceler.resolve({status: "canceled"});
                    $timeout.cancel(timeoutPromise);
                }
            };
        };

    }]);

})(angular);