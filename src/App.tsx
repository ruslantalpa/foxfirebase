import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import './App.css'

interface Category {
  CategoryID: number;
  CategoryName: string;
}

interface Product {
  ProductID: number;
  ProductName: string;
  UnitPrice: number;
  Category: Category;
}

interface OrderDetail {
  OrderID: number;
  ProductID: number;
  UnitPrice: number;
  Quantity: number;
  Discount: number;
  Product: Product;
}

interface Customer {
  CustomerID: string;
  CompanyName: string;
  ContactName: string;
}

interface Order {
  OrderID: number;
  OrderDate: string;
  RequiredDate: string;
  ShippedDate: string;
  ShipName: string;
  ShipAddress: string;
  ShipCity: string;
  ShipCountry: string;
  Customer: Customer;
  OrderDetails: OrderDetail[];
}

interface OrderSummary {
  OrderID: number;
  OrderDate: string;
  Customer: {
    CompanyName: string;
  };
}

const supabase = createClient(
  'http://localhost:5173',
  'dummy'
)

function App() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('Orders')
          .select(`
            OrderID,
            OrderDate,
            Customer:Customers(
              CompanyName
            )
          `)
          .order('OrderDate', { ascending: false })
        
        if (error) throw error
        setOrders(data as unknown as OrderSummary[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      }
    }

    fetchOrders()
  }, [])

  const fetchOrderDetails = async (orderId: number) => {
    try {
      const { data, error } = await supabase
        .from('Orders')
        .select(`
          OrderID,
          OrderDate,
          RequiredDate,
          ShippedDate,
          ShipName,
          ShipAddress,
          ShipCity,
          ShipCountry,
          Customer:Customers(
            CustomerID,
            CompanyName,
            ContactName
          ),
          OrderDetails:"Order Details"(
            OrderID,
            ProductID,
            UnitPrice,
            Quantity,
            Discount,
            Product:Products(
              ProductID,
              ProductName,
              UnitPrice,
              Category:Categories(
                CategoryID,
                CategoryName
              )
            )
          )
        `)
        .eq('OrderID', orderId)
        .single()
      
      if (error) throw error
      setSelectedOrder(data as unknown as Order)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const filteredOrders = orders.filter(order => 
    order.OrderID.toString().includes(searchTerm) ||
    order.Customer.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="App">
      <h1>Order Details</h1>
      {error && <div className="error">{error}</div>}
      
      <div className="order-selector">
        <input
          type="text"
          placeholder="Search by order ID or company name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="order-list">
          {filteredOrders.map(order => (
            <div 
              key={order.OrderID}
              className={`order-item ${selectedOrder?.OrderID === order.OrderID ? 'selected' : ''}`}
              onClick={() => fetchOrderDetails(order.OrderID)}
            >
              <span className="order-id">Order #{order.OrderID}</span>
              <span className="company-name">{order.Customer.CompanyName}</span>
              <span className="order-date">{new Date(order.OrderDate).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <div className="order-container">
          <div className="order-header">
            <h2>Order #{selectedOrder.OrderID}</h2>
            <div className="order-dates">
              <p><strong>Order Date:</strong> {new Date(selectedOrder.OrderDate).toLocaleDateString()}</p>
              <p><strong>Required Date:</strong> {new Date(selectedOrder.RequiredDate).toLocaleDateString()}</p>
              <p><strong>Shipped Date:</strong> {selectedOrder.ShippedDate ? new Date(selectedOrder.ShippedDate).toLocaleDateString() : 'Not shipped yet'}</p>
            </div>
          </div>

          <div className="customer-info">
            <h3>Customer Information</h3>
            <p><strong>Company:</strong> {selectedOrder.Customer.CompanyName}</p>
            <p><strong>Contact:</strong> {selectedOrder.Customer.ContactName}</p>
          </div>

          <div className="shipping-info">
            <h3>Shipping Details</h3>
            <p><strong>Name:</strong> {selectedOrder.ShipName}</p>
            <p><strong>Address:</strong> {selectedOrder.ShipAddress}</p>
            <p><strong>City:</strong> {selectedOrder.ShipCity}</p>
            <p><strong>Country:</strong> {selectedOrder.ShipCountry}</p>
          </div>

          <div className="order-items">
            <h3>Order Items</h3>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Quantity</th>
                  <th>Discount</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.OrderDetails.map((detail) => (
                  <tr key={`${detail.OrderID}-${detail.ProductID}`}>
                    <td>{detail.Product.ProductName}</td>
                    <td>{detail.Product.Category.CategoryName}</td>
                    <td>${detail.UnitPrice.toFixed(2)}</td>
                    <td>{detail.Quantity}</td>
                    <td>{(detail.Discount * 100).toFixed(0)}%</td>
                    <td>${(detail.UnitPrice * detail.Quantity * (1 - detail.Discount)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
