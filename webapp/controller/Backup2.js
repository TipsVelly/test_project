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
            this.initDefaultInfo();
            this.initDefaultInfo2();
            // 라우터 초기화
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("hyperView").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function(oEvent) {
            // ROUTER URL MATCH EVENT 함수
            this.search_model.setData({});
            // this.onSearch();
            this.loadCombinedData(this.oTable, ...this.aOModelOptions);
            // this._checkForeignKeyRelationship(this.getOwnerComponent().getModel("btpModel"), "BTPPoValidation", "BtpFinalProduction");
        },
        initDefaultInfo2: function() {
            // JSON Model 생성
            const oCombinedModel = new JSONModel({
                metadata: [],
                data: []
            });
            this.getView().setModel(oCombinedModel, "combinedModel");

            this.aOModelOptions = [
                {
                    oModel: this.getOwnerComponent().getModel("northwindModel"),
                    sEntitySet: "Products",
                    sJoinProperty: null,
                },
                {
                    oModel: this.getOwnerComponent().getModel("northwindModel"),
                    sEntitySet: "Categories",
                    sJoinProperty: null,
                }
            ];
        },
        
        initDefaultInfo: function() {
            //기본 변수값 설정 함수
            this.isUpdated = false;
            this.sSelectedPath  = null;
            this.oSearchForm = this.byId(this.ConstantControlIds.SEARCH_FORM);
            this.oTable = this.byId(this.ConstantControlIds.MAIN_TABLE);
            this.dialog_name = this.DialogNames.DIALOG_TEMPLATE_01;

            // searchModel 동적으로 설정하기
            const oControls = this.oSearchForm.getContent().filter(oControl => oControl.getMetadata().getName() !== 'sap.m.Label');
            const search_model_name = oControls[0].getBindingInfo('value').parts[0].model;
            this.search_model = this.getOwnerComponent().getModel(search_model_name);

            // table model 동적으로 설정하기
            this.entity_set_name = this.oTable.getBindingInfo('items').path.replace(/^\//, "");
            const odata_model_name = this.oTable.getBindingInfo('items').model;
            this.odata_model = this.getOwnerComponent().getModel(odata_model_name);

            // Create, Update Model 설정하기
            this.getView().setModel(new JSONModel({}), this.InputModelTypes.ADD_MODEL);
            this.getView().setModel(new JSONModel({}), this.InputModelTypes.UPDATE_MODEL);
            this.add_model = this.getView().getModel(this.InputModelTypes.ADD_MODEL);
            this.update_model = this.getView().getModel(this.InputModelTypes.UPDATE_MODEL);
        },

        onSearch: async function() {
            // 검색 실행 함수
            const oModel = this.odata_model; // ODataModel 가져오기
            const oSearchModelData = this.search_model.getData(); // 검색 모델 데이터 가져오기
            const sEntitySet = this.entity_set_name; // 엔티티셋 이름 설정
            const oEntityType = await this.getEntityType(oModel, sEntitySet);
            const aFilters = this.createFilters(oSearchModelData, oEntityType);
            const oBinding = this.oTable.getBinding('items');
            oBinding.filter(aFilters);
        },



        onAdd: async function() {
            // 추가 버튼 실행 함수
            this.isUpdated=false;
            await this.onOpenInputDialog({
                table: this.oTable,
                isUpdate: this.isUpdated,
                rowData: null,
                dialogName: this.dialog_name,
                odataModel:this.odata_model,
                entitysetName: this.entity_set_name,
                dialogModel: this.add_model
            });
        },

        onListItemPress: async function(oEvent) {
            // 테이블 리스트 클릭 이벤트 함수
            this.isUpdated = true;
            const oListItem = oEvent.getParameter("listItem");
            const oModel = oEvent.getSource().getBinding('items').getModel();
            this.sSelectedPath = oListItem.getBindingContextPath();
            const oSelectedData  = this.deepClone(oModel.getProperty(this.sSelectedPath));
            await this.onOpenInputDialog({
                table: this.oTable,
                isUpdate: this.isUpdated,
                rowData: oSelectedData,
                dialogName: this.dialog_name,
                odataModel:this.odata_model,
                entitysetName: this.entity_set_name,
                dialogModel: this.update_model
            });
        },



        onSubmitDialogButton: async function() {
            // 다이로그 저장 버튼 클릭 함수
            if(this.isUpdated) {
                await this.onUpdate();
            } else {
                await this.onRegister();
            }
        },



        onCloseDialogButton: function() {
            // 다이로그 취소 버튼 클릭 함수
            this.oDialog.close(); // dialog 닫기
        },



        onRegister: async function() {
            // 데이터 등록 함수
            this.getView().setBusy(true);
            if(!await this.validateInputs(this.odata_model, this.entity_set_name)) {
                this.getView().setBusy(false);
                return;
            }

            const oNewData = this.add_model.getData();
            this.odata_model.create("/" + this.entity_set_name, oNewData, {
                success: () => {
                    this.getView().setBusy(false);
                    MessageBox.success("데이터가 성공적으로 등록되었습니다.");
                },
                error: (e) => {
                    this.getView().setBusy(false);
                    console.log(e);
                    MessageBox.error("데이터 등록에 실패하였습니다.");
                    this.odata_model.refresh();
                }
            });
            this.onCloseDialogButton();
        },

        onUpdate: async function() {
            // 데이터 수정 함수
            this.getView().setBusy(true);
            const oUpdatedData = this.update_model.getData();
            const oModel = this.oTable.getBinding('items').getModel();
            const sPath = this.sSelectedPath;
            const oOldData = oModel.getProperty(sPath);

            if (!this.isDataChanged(oUpdatedData, oOldData)) {
                this.getView().setBusy(false);
                MessageBox.information("변경점이 없습니다.");
                return;
            }

            if (!await this.validateInputs(this.odata_model, this.entity_set_name)) {
                this.getView().setBusy(false);
                return;
            }

            this.odata_model.update(sPath, oUpdatedData, {
                success: () => {
                    this.getView().setBusy(false);
                    MessageBox.success("데이터가 성공적으로 업데이트되었습니다.");
                },

                error: (e) => {
                    this.getView().setBusy(false);
                    console.log(e);
                    MessageBox.error("데이터 업데이트에 실패하였습니다.");
                    this.odata_model.refresh();
                }

            });

            this.onCloseDialogButton();
        },

        onDelete: function() {
            // 데이터 삭제 함수
            this.getView().setBusy(true);
            const aSelectedContexts = this.oTable.getSelectedContexts();

            if (aSelectedContexts.length === 0) {
                this.getView().setBusy(false);
                MessageBox.warning("삭제할 데이터를 선택하세요.");
                return;
            }

            MessageBox.confirm("선택된 데이터를 삭제하시겠습니까?", {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: (sAction) => {
                    if (sAction === MessageBox.Action.YES) {
                        let iSuccessCount = 0;
                        let iErrorCount = 0;

                        const iTotalCount = aSelectedContexts.length;
                        
                        aSelectedContexts.forEach((oContext) => {
                            const sPath = oContext.getPath();
                            this.odata_model.remove(sPath, {
                                success: () => {
                                    iSuccessCount++;
                                    if (iSuccessCount + iErrorCount === iTotalCount) {
                                        this.getView().setBusy(false);
                                        this._showDeleteResult(iSuccessCount, iErrorCount);
                                    }
                                },
                                error: () => {
                                    iErrorCount++;
                                    if (iSuccessCount + iErrorCount === iTotalCount) {
                                        this.getView().setBusy(false);
                                        this.odata_model.refresh();
                                        this._showDeleteResult(iSuccessCount, iErrorCount);
                                    }
                                }
                            });
                        });

                        this.oTable.removeSelections(true);

                    } else {
                        this.getView().setBusy(false);
                    }
                }
            });
        }
    });
});