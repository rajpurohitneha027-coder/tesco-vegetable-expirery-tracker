// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TescoExpiryTracker {

    struct VegetableProduct {
        uint256 id;
        string productName;
        string sku;
        string batchNumber;
        string category;
        string supplier;
        address supplierWallet;
        uint256 harvestDate;
        uint256 packagingDate;
        uint256 expiryDate;
        uint256 addedAt;
        address addedBy;
        bool isRecalled;
        string recallReason;
        uint256 paymentSent;
    }

    struct StockAlert {
        uint256 productId;
        string alertType;
        string message;
        uint256 raisedAt;
        address raisedBy;
    }

    address public owner;
    uint256 private _productCounter;
    uint256 public paymentPerBatch = 0.05 ether;
    uint256 public totalPaidToSuppliers;

    mapping(uint256 => VegetableProduct) public products;
    mapping(address => bool) public authorisedStaff;
    mapping(string => uint256[]) public skuToProductIds;
    mapping(string => uint256[]) public categoryToProductIds;
    uint256[] public allProductIds;
    StockAlert[] public stockAlerts;

    event ProductAdded(uint256 indexed id, string productName, string sku, uint256 expiryDate, address indexed addedBy);
    event ProductRecalled(uint256 indexed id, string reason, address indexed recalledBy);
    event StaffAuthorised(address indexed staff);
    event StaffRevoked(address indexed staff);
    event StockAlertRaised(uint256 indexed productId, string alertType, string message);
    event SupplierPaid(uint256 indexed productId, address indexed supplierWallet, uint256 amount);
    event ContractFunded(address indexed by, uint256 amount);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyAuthorised() { require(authorisedStaff[msg.sender] || msg.sender == owner, "Not authorised"); _; }
    modifier validProduct(uint256 _id) { require(_id > 0 && _id <= _productCounter, "Product does not exist"); _; }

    constructor() {
        owner = msg.sender;
        authorisedStaff[msg.sender] = true;
        emit StaffAuthorised(msg.sender);
    }

    receive() external payable {
        emit ContractFunded(msg.sender, msg.value);
    }

    function fundContract() external payable onlyOwner {
        emit ContractFunded(msg.sender, msg.value);
    }

    function setPaymentPerBatch(uint256 _amount) external onlyOwner {
        paymentPerBatch = _amount;
    }

    function withdrawFunds(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(_amount);
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    function authoriseStaff(address _staff) external onlyOwner {
        require(_staff != address(0), "Invalid address");
        authorisedStaff[_staff] = true;
        emit StaffAuthorised(_staff);
    }

    function revokeStaff(address _staff) external onlyOwner {
        require(_staff != owner, "Cannot revoke owner");
        authorisedStaff[_staff] = false;
        emit StaffRevoked(_staff);
    }

    function addProduct(
        string calldata _productName,
        string calldata _sku,
        string calldata _batchNumber,
        string calldata _category,
        string calldata _supplier,
        address _supplierWallet,
        uint256 _harvestDate,
        uint256 _packagingDate,
        uint256 _expiryDate
    ) external onlyAuthorised returns (uint256 id) {
        require(bytes(_productName).length > 0, "Product name required");
        require(bytes(_sku).length > 0, "SKU required");

        _productCounter++;
        id = _productCounter;

        uint256 paid = 0;
        if (paymentPerBatch > 0 && _supplierWallet != address(0) && address(this).balance >= paymentPerBatch) {
            payable(_supplierWallet).transfer(paymentPerBatch);
            totalPaidToSuppliers += paymentPerBatch;
            paid = paymentPerBatch;
            emit SupplierPaid(id, _supplierWallet, paymentPerBatch);
        }

        products[id] = VegetableProduct({
            id: id, productName: _productName, sku: _sku,
            batchNumber: _batchNumber, category: _category, supplier: _supplier,
            supplierWallet: _supplierWallet,
            harvestDate: _harvestDate, packagingDate: _packagingDate,
            expiryDate: _expiryDate, addedAt: block.timestamp,
            addedBy: msg.sender, isRecalled: false, recallReason: "",
            paymentSent: paid
        });

        allProductIds.push(id);
        skuToProductIds[_sku].push(id);
        categoryToProductIds[_category].push(id);
        emit ProductAdded(id, _productName, _sku, _expiryDate, msg.sender);

        if (_expiryDate <= block.timestamp + 3 days) {
            string memory alertMsg = string(abi.encodePacked(_productName, " expires within 3 days!"));
            stockAlerts.push(StockAlert(id, "EXPIRING_SOON", alertMsg, block.timestamp, msg.sender));
            emit StockAlertRaised(id, "EXPIRING_SOON", alertMsg);
        }
        return id;
    }

    function recallProduct(uint256 _id, string calldata _reason) external onlyAuthorised validProduct(_id) {
        require(!products[_id].isRecalled, "Already recalled");
        require(bytes(_reason).length > 0, "Reason required");
        products[_id].isRecalled = true;
        products[_id].recallReason = _reason;
        string memory alertMsg = string(abi.encodePacked(products[_id].productName, " recalled: ", _reason));
        stockAlerts.push(StockAlert(_id, "RECALLED", alertMsg, block.timestamp, msg.sender));
        emit ProductRecalled(_id, _reason, msg.sender);
        emit StockAlertRaised(_id, "RECALLED", alertMsg);
    }

    function getProduct(uint256 _id) external view validProduct(_id) returns (VegetableProduct memory) { return products[_id]; }

    function getProducts(uint256 _from, uint256 _count) external view returns (VegetableProduct[] memory) {
        uint256 total = allProductIds.length;
        if (_from >= total) return new VegetableProduct[](0);
        uint256 end = _from + _count > total ? total : _from + _count;
        VegetableProduct[] memory result = new VegetableProduct[](end - _from);
        for (uint256 i = _from; i < end; i++) result[i - _from] = products[allProductIds[i]];
        return result;
    }

    function getProductsExpiringSoon(uint256 _withinSeconds) external view returns (VegetableProduct[] memory) {
        uint256 deadline = block.timestamp + _withinSeconds;
        uint256 count = 0;
        for (uint256 i = 0; i < allProductIds.length; i++) {
            VegetableProduct storage p = products[allProductIds[i]];
            if (!p.isRecalled && p.expiryDate >= block.timestamp && p.expiryDate <= deadline) count++;
        }
        VegetableProduct[] memory result = new VegetableProduct[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < allProductIds.length; i++) {
            VegetableProduct storage p = products[allProductIds[i]];
            if (!p.isRecalled && p.expiryDate >= block.timestamp && p.expiryDate <= deadline) result[j++] = p;
        }
        return result;
    }

    function getExpiredProducts() external view returns (VegetableProduct[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allProductIds.length; i++)
            if (!products[allProductIds[i]].isRecalled && products[allProductIds[i]].expiryDate < block.timestamp) count++;
        VegetableProduct[] memory result = new VegetableProduct[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < allProductIds.length; i++) {
            VegetableProduct storage p = products[allProductIds[i]];
            if (!p.isRecalled && p.expiryDate < block.timestamp) result[j++] = p;
        }
        return result;
    }

    function getProductsByCategory(string calldata _category) external view returns (VegetableProduct[] memory) {
        uint256[] storage ids = categoryToProductIds[_category];
        VegetableProduct[] memory result = new VegetableProduct[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) result[i] = products[ids[i]];
        return result;
    }

    function totalProducts() external view returns (uint256) { return _productCounter; }
    function totalAlerts() external view returns (uint256) { return stockAlerts.length; }
    function getAlert(uint256 _index) external view returns (StockAlert memory) {
        require(_index < stockAlerts.length, "Out of bounds");
        return stockAlerts[_index];
    }
}
