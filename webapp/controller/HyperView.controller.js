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
            this.loadCombinedData(...this.aOModelOptions);
            // this._checkForeignKeyRelationship(this.getOwnerComponent().getModel("btpModel"), "BTPPoValidation", "BtpFinalProduction");
        },
        initDefaultInfo2: function() {
            // JSON Model 생성
            const oCombinedModel = new JSONModel({
                metadata: [],
                data: []
            });
            this.getView().setModel(oCombinedModel, "combinedModel");

            this.aOModelOptions = [];

            this.aOModelOptions[0] = {
                oModel: this.getOwnerComponent().getModel("northwindModel"),
                sEntitySet: "Customers",
                joinProperty: null,
            };
            this.aOModelOptions[1] = {
                oModel: this.getOwnerComponent().getModel("btpModel"),
                sEntitySet: "BTPPoValidation",
                joinProperty: null,
            };
        },
        
        loadCombinedData: async function(...aOptions) {
            try {
                // 각 모델의 Service URL을 추출하여 배열에 저장
                const aServiceUrls = aOptions.map(({ oModel }) => oModel.sServiceUrl);
                // 첫 번째 모델의 Service URL을 메인 URL로 설정
                const sMainServiceUrl = aServiceUrls[0];
        
                // 확장할 엔티티셋 이름들을 저장할 배열
                let aExpandEntities = [];
        
                // 강제 조인 조건을 저장할 배열
                let aJoinConditions = [];
        
                // 첫 번째 모델 옵션을 메인 옵션으로 설정
                const oMainOption = aOptions[0];
        
                // 메인 서비스 URL과 나머지 서비스 URL 비교
                for (let i = 1; i < aServiceUrls.length; i++) {
                    const sServiceUrl = aServiceUrls[i];
                    const oCurrentOption = aOptions[i];
        
                    if (sServiceUrl === sMainServiceUrl) {
                        // 같은 서비스 URL을 사용하는 경우 외래키 여부 체크
                        const isForeignKeyRelated = await this._checkForeignKeyRelationship(
                            oMainOption.oModel,       // 메인 모델
                            oMainOption.sEntitySet,   // 메인 엔티티셋 이름
                            oCurrentOption.sEntitySet // 현재 비교하는 엔티티셋 이름
                        );
        
                        if (isForeignKeyRelated) {
                            // 외래키 관계가 있을 경우, 확장할 엔티티셋 이름 추가
                            aExpandEntities.push(oCurrentOption.sEntitySet);
                            console.log(`Foreign key relation found. Adding ${oCurrentOption.sEntitySet} to expand list.`);
                        } else {
                            // 같은 모델이지만 외래키 관계가 없을 때 강제 조인 조건 추가
                            aJoinConditions.push({
                                mainEntitySet: oMainOption.sEntitySet,       // 메인 엔티티셋 이름
                                joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                                mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                                joinJoinProperty: oCurrentOption.joinProperty, // 조인할 조인 프로퍼티
                                mainModel: oMainOption.oModel,               // 메인 모델 추가
                                joinModel: oCurrentOption.oModel             // 조인할 모델 추가
                            });
                        }
                    } else {
                        // 다른 서비스 URL을 사용하는 경우 강제 조인 조건 추가
                        // 서로 다른 모델 간 강제 조인을 수행하기 위해 조인 조건 설정
                        aJoinConditions.push({
                            mainEntitySet: oMainOption.sEntitySet,       // 메인 엔티티셋 이름
                            joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                            mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                            joinJoinProperty: oCurrentOption.joinProperty, // 조인할 조인 프로퍼티
                            mainModel: oMainOption.oModel,               // 메인 모델 추가
                            joinModel: oCurrentOption.oModel             // 조인할 모델 추가
                        });
                        console.log(`Adding join condition between different models: ${oMainOption.sEntitySet} and ${oCurrentOption.sEntitySet}.`);
                    }
                }
        
                if (aExpandEntities.length > 0) {
                    // $expand를 위한 쿼리 문자열을 생성
                    const sExpandQuery = aExpandEntities.join(',');
        
                    console.log(`Fetching data with $expand: ${sExpandQuery}`);
                    
                    const oData = await this._readODataAsync(oMainOption, oMainOption.sEntitySet, {"$expand": sExpandQuery});
                    this._bindCombinedModel(null, { data: oData.results });
                } 
                else if (aJoinConditions.length > 0) {
                    // 강제 조인 조건에 따라 데이터를 가져와 조인
                    for (const condition of aJoinConditions) {
                        // 다른 모델 간의 조인 조건이 있는 경우 이를 처리
                        if (condition.mainModel && condition.joinModel) {
                            await this._performForcedJoinBetweenModels(condition);
                        } else {
                            // 동일 모델 내 조인 조건인 경우
                            await this._performForcedJoin(condition);
                        }
                    }
                }
                else {
                    throw Error("해당하는 조인 조건을 찾을 수가 없습니다.");
                }
        
            } catch (error) {
                console.error("Error loading combined data:", error);
            }
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