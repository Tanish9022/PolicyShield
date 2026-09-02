import { useState, useEffect } from 'react';
import { Package, Plus, Loader2 } from 'lucide-react';

interface InventoryItem {
  product_id: string;
  name: string;
  price: number;
  currency: string;
  stock_level: number;
}

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    product_id: '',
    name: '',
    price: '',
    stock_level: ''
  });

  const fetchInventory = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/merchant/inventory');
      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('http://localhost:3001/api/merchant/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: formData.product_id,
          name: formData.name,
          price: Number(formData.price),
          stock_level: Number(formData.stock_level)
        })
      });
      setShowModal(false);
      setFormData({ product_id: '', name: '', price: '', stock_level: '' });
      fetchInventory(); // refresh list
    } catch (error) {
      console.error('Failed to save item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
          <Package className="text-primary" size={20} />
          Inventory Management
        </h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          New Item
        </button>
      </div>

      <div className="border border-white/5 bg-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-4 text-xs font-medium text-white/50 uppercase tracking-wider">Product ID</th>
                <th className="px-6 py-4 text-xs font-medium text-white/50 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-medium text-white/50 uppercase tracking-wider">Price (INR)</th>
                <th className="px-6 py-4 text-xs font-medium text-white/50 uppercase tracking-wider">Stock Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-white/40">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-white/40">
                    No items in inventory.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.product_id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm font-code text-white/60">{item.product_id}</td>
                    <td className="px-6 py-4 text-sm font-medium text-white">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-white/70">₹{item.price.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
                        item.stock_level > 5 ? 'bg-emerald-500/10 text-emerald-400' :
                        item.stock_level > 0 ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {item.stock_level} IN STOCK
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0a0a0e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h2 className="text-lg font-semibold text-white">Add New Item</h2>
              <p className="text-sm text-white/50 mt-1">Add a new product to your inventory catalog.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Product ID</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. prod_watch"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.product_id}
                  onChange={(e) => setFormData({...formData, product_id: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1.5">Product Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Apple Watch Series 9"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Price (INR)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="40000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1.5">Initial Stock</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    placeholder="10"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.stock_level}
                    onChange={(e) => setFormData({...formData, stock_level: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/5 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
