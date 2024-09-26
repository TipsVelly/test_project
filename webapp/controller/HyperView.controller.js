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
            // this.loadCombinedData();
            this.loadCombinedDataV2(...this.aOModelOptions);
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
                joinProperty: "Name1",
            };
            this.aOModelOptions[1] = {
                oModel: this.getOwnerComponent().getModel("btpModel"),
                sEntitySet: "BTPPoValidation",
                joinProperty: "Name2",
            };
        },

        
        loadCombinedDataV2: async function(...aOptions) {
            try {
                // 각 모델의 Service URL을 추출하여 배열에 저장
                const aServiceUrls = aOptions.map(({oModel}) => oModel.sServiceUrl);
                // 첫 번째 모델의 Service URL을 메인 URL로 설정
                const sMainServiceUrl = aServiceUrls[0];

                // 확장할 엔티티셋 이름들을 저장할 배열
                const aExpandEntities = [];

                // 강제 조인 조건을 저장할 배열
                const aJoinConditions = [];

                // 첫 번째 모델 옵션을 메인옵션으로 설정
                const oMainOption = aOptions[0];

                // 메인 서비스 URL과 나머지 서비스 URL 비교
                for (let i = 1; i < aServiceUrls.length; i++) {
                    const sServiceUrl = aServiceUrls[i];
                    const oCurrentOption = aOptions[i];

                    if(sServiceUrl === sMainServiceUrl) {
                        // 메인 서비스 URL과 같을 경우, 외래키 여부 체크
                        const isForeignKeyRelated = this._checkForeignKeyRelationship(
                            oMainOption.oModel,         // 메인 모델
                            oMainOption.sEntitySet,     // 메인 엔티티셋 이름
                            oCurrentOption.sEntitySet   // 현재 비교하는 엔티티셋 이름
                        );

                        if(isForeignKeyRelated) {
                            // 외래키 관계가 있을 경우, 확장할 엔티티셋 이름 추가
                            aExpandEntities.push(oCurrentOption.sEntitySet);
                            console.log(`Foreign key relation found. Adding ${oCurrentOption.sEntitySet} to expand list.`);
                        } else {
                            // 외래키 관계가 없으면 강제 조언 조건으로 'joinProperty'를 사용
                            aJoinConditions.push({
                                mainEntitySet: oMainOption.sEntitySet, // 메인 엔티티셋 이름
                                joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                                mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                                joinJoinProperty: oCurrentOption.joinProperty // 조인할 조인 프로퍼티
                            });
                        }
                    } else {
                        // 메인 서비스 URL과 다를 경우에도 강제 조인 조건으로 `joinProperty` 사용
                        aJoinConditions.push({
                            mainEntitySet: oMainOption.sEntitySet,       // 메인 엔티티셋 이름
                            joinEntitySet: oCurrentOption.sEntitySet,    // 조인할 엔티티셋 이름
                            mainJoinProperty: oMainOption.joinProperty,  // 메인 조인 프로퍼티
                            joinJoinProperty: oCurrentOption.joinProperty // 조인할 조인 프로퍼티
                        });
                    }

                    if(aExpandEntities.length > 0) {
                        // $expand를 위한 쿼리 문자열을 생성
                        const sExpandQuery = aExpandEntities.join(',');

                        console.log(`Fetching data with $expand: ${sExpandQuery}`);

                        // 메인 모델에서 $expand를 사용하여 데이터 읽기
                        oMainOption.oModel.read(`/${oMainOption.sEntitySet}`, {
                            urlParameters: {
                                "$expand": sExpandQuery // 동적으로 생성된 $expand 쿼리 설정
                            },
                            success: (oData) => {
                                // 데이터 결합 후 모델에 바인딩
                                this._bindCombinedModel(oData);
                            },
                            error: (oError) => {
                                console.error("Error fetching data with $expand:", oError);
                            }
                        });
                    }

                    if (aJoinConditions.length > 0) {
                        // 강제 조인 조건에 따라 데이터를 가져와 조인
                        for (const condition of aJoinConditions) {
                            this._performForcedJoin(oMainOption, condition);
                        }
                    }
                }

            } catch (error) {
                onsole.error("Error loading combined data:", error);
            }
        },

        // 외래키 관계 여부를 체크하는 함수
        _checkForeignKeyRelationship: async function(oModel,  sEntitySetName1, sEntitySetName2) {
            const oMetadata = oModel.getServiceMetadata(); //모델의 메타데이터를 가져옴
            if(!oMetadata) {
                await oModel.metadataLoaded();
                oMetadata = oModel.getServiceMetadata();
            }
            const oEntitySet1 = this._getEntitySetProperties(oMetadata, sEntitySetName1); // 첫 번째 엔티티셋 정보 추출
            const oEntitySet2 = this._getEntitySetProperties(oMetadata, sEntitySetName2); // 두 번째 엔티티셋 정보 추출

            // 첫 번째 엔티티셋의 모든 속성 이름을 배열로 추출
            const aEntitySet1Properties = oEntitySet1.properties.map(prop => prop.name);
            
            // 두 번째 엔티티셋의 모든 속성 이름을 배열로 추출
            const aEntitySet2Properties = oEntitySet2.properties.map(prop => prop.name);

            // 첫 번째 엔티티셋의 속성 중 두 번째 엔티티셋에 존재하는 속성이 있는지 확인
            return aEntitySet1Properties.some(prop => aEntitySet2Properties.includes(prop));
        },

         // 두 EntitySet의 데이터를 읽어와 결합해서 하나의 모델로 만드는 함수
        loadCombinedData: async function() {
            const northwindModel =this.aODataModels[0];
            const btpModel = this.aODataModels[1];

            // await northwindModel.metadataLoaded();
            // await btpModel.metadataLoaded();

            console.log("metadata loaded.");
            
            // 첫 번째 EntitySet 데이터 읽기
            northwindModel.read(`/${this.odata_01_name}`, {
                success: (oData1) => {
                    

                    // 두 번째 EntitySet 데이터 읽기
                    btpModel.read(`/${this.odata_02_name}`, {
                        success: (oData2) => {
                            // 두 데이터 통합
                            // 첫 번째 odata EntitySet metadata 읽기
                            const oMetadata1 = this.odataModel1.getServiceMetadata();

                            // 두 번째 odata entitySet metadata 읽기
                            const oMetadata2 = this.odataModel2.getServiceMetadata();

                            const oCombinedData = oData1.results.map((item1, index) => {
                                // oData2의 인덱스에 해당하는 아이템이 있는지 확인
                                const item2 = oData2.results[index] || {}; // 존재하지 않으면 빈 객체로 반환

                                // 하나의 객체로 통합
                                return {
                                    id: index,
                                    ...item1,
                                    ...item2,
                                    __metadata:[]
                                }
                            });
                            const oNewModelData = {
                                metadata: [
                                    {   
                                        uri: oData1.results[0].__metadata.uri.split("(")[0],
                                        entityType: this._getEntitySetProperties(oMetadata1, this.odata_01_name)
                                    },
                                    {
                                        uri: oData2.results[0].__metadata.uri.split("(")[0],
                                        entityType: this._getEntitySetProperties(oMetadata2, this.odata_02_name)
                                    }
                                ],
                                data: oCombinedData
                            }
                            
                            // JSON Model에 결합된 데이터 설정
                            const oCombinedModel = this.oTable.getBinding('items').getModel();
                            oCombinedModel.setData(oNewModelData);
                        }
                    });
                }
            });
        },

        // EntitySet의 속성 정보 객체배열을 반환하는 함수
        _getEntitySetProperties: function(oMetadata, sEntitySetName) {
            if(!oMetadata) 
                throw new Error("metadata not bean");
            if(typeof oMetadata !== "object")
                throw new Error("metadata parameter type don't matched object type");

            // 엔티티셋 정보 찾기
            const oEntitySet = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.entityContainer || []) 
                .flatMap(oContainer => oContainer.entitySet || [])
                .find(oEntitySet => oEntitySet.name === sEntitySetName);

            if (!oEntitySet) {
                throw new Error(`EntitySet '${sEntitySetName}' not found.`);
            }

            // 엔티티 타입 정보 찾기
            const sEntityTypeName = oEntitySet.entityType;
            const oEntityType = oMetadata.dataServices.schema
                .flatMap(oSchema => oSchema.entityType)
                .find(entityType => entityType.name === sEntityTypeName.split('.').pop());

            if(!oEntityType) {
                throw new Error(`EntityType '${sEntityTypeName}' not found.`);
            }
           
            // 키 속성 목록
            const aKeyProperties = oEntityType.key.propertyRef.map(prop => prop.name);

            // 속성 정보 구성
            const aProperties = oEntityType.property.map(prop => ({
                name: prop.name,
                type: prop.type,
                isKey: aKeyProperties.includes(prop.name)
            }));
            
            return {
                entityTypeName: oEntityType.name,
                properties: aProperties
            };
        },

        // CRUD 작업을 위한 공통함수
        createData: async function(oNewData) {
            const oMetadata = this.oTable.getBinding('items').getModel().getProperty("/metadata");


            // 각각 모델에 데이터 생성
            oMetadata.forEach((oEntityInfo, index) => {
                const oModel = this.aODataModels[index];
                const sEntitySetName = oEntityInfo.uri.split("/").pop();

                const oNewEntityData = {};
            });
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