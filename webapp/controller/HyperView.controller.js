sap.ui.define([
    "com/tipsvally/testproject/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "com/tipsvally/testproject/util/Formatter"
], function (BaseController, JSONModel, MessageBox, Formatter) {
    "use strict";
    return BaseController.extend("com.tipsvally.testproject.controller.HyperView", {
        formatter: Formatter,
        onInit: function() {
            // 기본 설정 셋팅
            this.oSearchForm = this.byId(this.ConstantControlIds.SEARCH_FORM);
            this.oTable = this.byId(this.ConstantControlIds.MAIN_TABLE);

            const oControls = this.oSearchForm.getContent().filter(oControl => oControl.getMetadata().getName() !== 'sap.m.Label');
            const search_model_name = oControls[0].getBindingInfo('value').parts[0].model;
            this.search_model = this.getOwnerComponent().getModel(search_model_name);
            // 라우터 초기화
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("hyperView").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function(oEvent) {
            // ROUTER URL MATCH EVENT 함수
            this.search_model.setData({});
            // this.onSearch();
            const northwindModel = this.getOwnerComponent().getModel("northwindModel");
            this.loadCombinedEntitiesV2(
                new this.CombindEntity(northwindModel, "Products", null, this.EntityRoleType.PRIMARY, ["Name", "ID"]), 
                new this.CombindEntity(northwindModel, "Categories", null, this.EntityRoleType.SUBORDINATE, ["Name"])
            );
        }
    });
});