import React from 'react';
import { X, ShieldCheck, AlertTriangle, FileText } from 'lucide-react';

export const TermsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Terms and Conditions & Liability Waiver
              </h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                LitterLooker Community & Safety Guidelines
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-black text-amber-900 dark:text-amber-300 uppercase tracking-wide text-xs mb-1">
                CRITICAL DISCLAIMER: REAL-WORLD ACTIVITIES
              </h4>
              <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-normal">
                LitterLooker is solely a digital platform for mapping, community organization, and coordination. <strong>LitterLooker, its creators, developers, and affiliates are NOT responsible or liable for any injuries, accidents, property damage, legal infractions, trespassing, wildlife encounters, environmental hazards, or incidents of any kind</strong> occurring outside the application or during real-world cleanups, meetups, or community events.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> 1. Acceptance of Terms
              </h3>
              <p>
                By creating an account, accessing, or using LitterLooker ("the App"), you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use the application or participate in its community events.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> 2. Assumption of Risk & Voluntary Participation
              </h3>
              <p>
                All cleanup activities, meetups, navigation to pins, and community actions coordinated through LitterLooker are strictly voluntary. You acknowledge that participating in physical cleanup involves inherent risks, including but not limited to sharp objects, hazardous waste, heavy lifting, traffic, uneven terrain, adverse weather, and biological agents. You assume full personal responsibility for your safety and well-being.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> 3. Code of Conduct & Legal Compliance
              </h3>
              <p>
                Users agree to abide by all local, state, and federal laws. You agree not to trespass on private property without explicit permission, not to handle hazardous materials beyond your training or safety equipment capacity, and to dispose of collected waste in accordance with local municipal guidelines. Harassment, abusive language, spamming pins, or falsifying cleanup reports will result in immediate account suspension or termination.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> 4. Intellectual Property & User Content
              </h3>
              <p>
                You retain ownership of photos and content you upload, but grant LitterLooker a license to display and share such content within the app for community coordination and environmental tracking. You warrant that your submissions do not infringe on copyright or privacy rights.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" /> 5. Limitation of Liability
              </h3>
              <p>
                To the maximum extent permitted by law, LitterLooker and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the application or participation in real-world cleanups.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-white font-black rounded-xl text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};
